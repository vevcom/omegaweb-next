export type SeatingGuest = { id: number, name: string, committees: string[] }
/** The guests each guest wants to sit with, most wanted first. */
export type SeatingWishes = Record<number, number[]>
export type SeatingPlan = { tables: number[][], unseated: number[] }

// The first wish a guest gets is worth the most, so everyone getting one beats a few getting all three.
export const FULFILLED_WISH_POINTS = [20, 4, 2]
export const MAX_WISHES = 3
export const MAX_TABLES = 200
export const MAX_SEATS_PER_TABLE = 100
export const MUTUAL_WISH_POINTS = 2
// Lower than a first wish, so a committee is split rather than leaving someone with none of their wishes.
export const SHARED_COMMITTEE_POINTS = 1
const UNSEATED_PENALTY = 100
// Squared per table, so empty seats spread out, without outweighing a first wish.
const EMPTY_SEAT_PENALTY = 1
const ITERATIONS = 300_000
const START_TEMPERATURE = 4
// Random swaps rarely help at a big dinner, so this share of them go to the table of someone wished for.
const AIMED_SHARE = 0.5
const END_TEMPERATURE = 0.05

/** Park-Miller, so the same seed gives the same plan. The seed must be positive. */
function seededRandom(seed: number) {
    let state = seed
    return () => {
        state = (state * 16807) % 2147483647
        return state / 2147483647
    }
}

/** The points of those sitting together. A plan's score is the sum over its tables, so a swap only rescores two. */
function tableScore(members: number[], guests: Map<number, SeatingGuest>, wishes: SeatingWishes) {
    let score = 0
    members.forEach((guestId, index) => {
        const fulfilled = (wishes[guestId] ?? []).filter(wished => members.includes(wished))
        fulfilled.forEach((wished, rank) => {
            score += FULFILLED_WISH_POINTS[rank] ?? 0
            if (wishes[wished]?.includes(guestId)) score += MUTUAL_WISH_POINTS / 2
        })
        const committees = guests.get(guestId)?.committees ?? []
        members.slice(index + 1).forEach(other => {
            if (guests.get(other)?.committees.some(committee => committees.includes(committee))) {
                score += SHARED_COMMITTEE_POINTS
            }
        })
    })
    return score
}

/**
 * Finding the best plan is too slow, so this anneals: it swaps two random guests and keeps the swap
 * if the score rises, or sometimes if it falls, which gets ever rarer. That way it does not get
 * stuck on a plan no single swap improves. Locked guests stay at their table, given by its index.
 */
export function createSeatingPlan({ guests, wishes, seats, locked = {}, seed = 1 }: {
    guests: SeatingGuest[],
    wishes: SeatingWishes,
    seats: number[],
    locked?: Record<number, number>,
    seed?: number,
}): SeatingPlan {
    const guestsById = new Map(guests.map(guest => [guest.id, guest]))
    const random = seededRandom(seed)

    // Guests who do not fit sit at a last table, which is left out of the plan.
    const unseatedTable = seats.length
    const tables: number[][] = [...seats, guests.length].map(() => [])
    const lockedIds = guests.map(guest => guest.id).filter(id => locked[id] !== undefined)
    lockedIds.forEach(id => tables[locked[id]].push(id))
    const free = guests.map(guest => guest.id).filter(id => locked[id] === undefined)
    tables.forEach((table, index) => {
        const capacity = index === unseatedTable ? guests.length : seats[index]
        table.push(...free.splice(0, Math.max(0, capacity - table.length)))
    })

    const scoreOf = (index: number) => (index === unseatedTable
        ? -UNSEATED_PENALTY * tables[index].length
        : tableScore(tables[index], guestsById, wishes) - EMPTY_SEAT_PENALTY * (seats[index] - tables[index].length) ** 2)

    // A slot holding null is an empty seat, so a guest can also move to one.
    const slots = tables.flatMap((table, index) => {
        const capacity = index === unseatedTable ? guests.length : seats[index]
        const empty = Array.from({ length: Math.max(0, capacity - table.length) }, () => null)
        return [...table, ...empty].map((guestId: number | null) => ({ guestId, index }))
    }).filter(slot => slot.guestId === null || !lockedIds.includes(slot.guestId))

    const slotOfGuest = new Map(slots.flatMap(slot => (slot.guestId === null ? [] : [[slot.guestId, slot] as const])))
    const slotsOfTable = tables.map((_, index) => slots.filter(slot => slot.index === index))
    const pick = <Item, >(items: Item[]) => items[Math.floor(random() * items.length)]

    const pickSecond = (first: typeof slots[number]) => {
        const wished = first.guestId !== null && random() < AIMED_SHARE ? pick(wishes[first.guestId] ?? []) : undefined
        const table = wished === undefined ? undefined : slotOfGuest.get(wished)?.index
        return table === undefined || slotsOfTable[table].length === 0 ? pick(slots) : pick(slotsOfTable[table])
    }

    const swap = (first: typeof slots[number], second: typeof slots[number]) => {
        const [firstGuest, secondGuest] = [first.guestId, second.guestId]
        tables[first.index] = tables[first.index].filter(id => id !== firstGuest)
        tables[second.index] = tables[second.index].filter(id => id !== secondGuest)
        if (secondGuest !== null) tables[first.index].push(secondGuest)
        if (firstGuest !== null) tables[second.index].push(firstGuest)
        first.guestId = secondGuest
        second.guestId = firstGuest
        if (secondGuest !== null) slotOfGuest.set(secondGuest, first)
        if (firstGuest !== null) slotOfGuest.set(firstGuest, second)
    }

    const cooling = (END_TEMPERATURE / START_TEMPERATURE) ** (1 / ITERATIONS)
    let temperature = START_TEMPERATURE
    for (let iteration = 0; iteration < ITERATIONS && slots.length > 1; iteration++) {
        temperature *= cooling
        const first = pick(slots)
        const second = pickSecond(first)
        if (first.index === second.index || first.guestId === second.guestId) continue

        const before = scoreOf(first.index) + scoreOf(second.index)
        swap(first, second)
        const change = scoreOf(first.index) + scoreOf(second.index) - before
        if (change < 0 && random() >= Math.exp(change / temperature)) swap(first, second)
    }

    return { tables: tables.slice(0, unseatedTable), unseated: tables[unseatedTable] }
}

export function fulfilledWishes(guestId: number, plan: SeatingPlan, wishes: SeatingWishes) {
    const table = plan.tables.find(members => members.includes(guestId)) ?? []
    return (wishes[guestId] ?? []).filter(wished => table.includes(wished))
}

export function seatingSummary(plan: SeatingPlan, guests: SeatingGuest[], wishes: SeatingWishes) {
    const wishing = guests.filter(guest => wishes[guest.id]?.length)
    const counts = wishing.map(guest => fulfilledWishes(guest.id, plan, wishes).length)

    const committeeMembers = guests.filter(guest => guests.some(other => (
        other.id !== guest.id && other.committees.some(committee => guest.committees.includes(committee))
    )))
    const withCommittee = committeeMembers.filter(guest => (
        (plan.tables.find(members => members.includes(guest.id)) ?? []).some(other => other !== guest.id && (
            guests.find(candidate => candidate.id === other)?.committees.some(
                committee => guest.committees.includes(committee)
            )
        ))
    ))

    return {
        wishing: wishing.length,
        gotAWish: counts.filter(count => count > 0).length,
        gotAllWishes: counts.filter((count, index) => count === wishes[wishing[index].id].length).length,
        committeeMembers: committeeMembers.length,
        withCommittee: withCommittee.length,
    }
}

/** Moves a guest to a table, or away from all tables with null. */
export function moveGuest(plan: SeatingPlan, guestId: number, tableIndex: number | null): SeatingPlan {
    const tables = plan.tables.map(members => members.filter(id => id !== guestId))
    const unseated = plan.unseated.filter(id => id !== guestId)
    if (tableIndex === null) return { tables, unseated: [...unseated, guestId] }
    tables[tableIndex].push(guestId)
    return { tables, unseated }
}

/** Two guests trading places, wherever they are sitting. */
export function swapGuests(plan: SeatingPlan, first: number, second: number): SeatingPlan {
    const trade = (id: number) => {
        if (id === first) return second
        return id === second ? first : id
    }
    return { tables: plan.tables.map(members => members.map(trade)), unseated: plan.unseated.map(trade) }
}

/** Reads "5x8", or each table as "10, 10, 8", into the seats of each table. Null when it makes no sense. */
export function parseSeats(text: string): number[] | null {
    const seats: number[] = []
    for (const token of text.split(/[,;\s]+/).filter(Boolean)) {
        const match = /^(?:(\d+)[x*×])?(\d+)$/i.exec(token)
        if (!match || Number(match[2]) < 1 || Number(match[2]) > MAX_SEATS_PER_TABLE) return null
        seats.push(...Array<number>(Number(match[1] ?? 1)).fill(Number(match[2])))
        if (seats.length > MAX_TABLES) return null
    }
    return seats.length > 0 ? seats : null
}

export function displaySeats(seats: number[]) {
    return seats.every(count => count === seats[0]) ? `${seats.length}x${seats[0]}` : seats.join(', ')
}

/** Keeps who still has room at their table, so changing the tables does not undo the work. */
export function resizePlan(plan: SeatingPlan, seats: number[]): SeatingPlan {
    const tables = seats.map((capacity, index) => (plan.tables[index] ?? []).slice(0, capacity))
    const seated = new Set(tables.flat())
    return { tables, unseated: [...plan.unseated, ...plan.tables.flat().filter(id => !seated.has(id))] }
}

/** Fits a plan to who is registered now, which may have changed while it was being worked on. */
export function reconcilePlan(plan: SeatingPlan, guestIds: number[]): SeatingPlan {
    const present = new Set(guestIds)
    const tables = plan.tables.map(members => members.filter(id => present.has(id)))
    const unseated = plan.unseated.filter(id => present.has(id))
    const placed = new Set([...tables.flat(), ...unseated])
    return { tables, unseated: [...unseated, ...guestIds.filter(id => !placed.has(id))] }
}
