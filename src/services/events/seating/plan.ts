import { DEFAULT_SEATING_POINTS, MAX_SEATS_PER_TABLE, MAX_TABLES } from './constants'

export type SeatingGuest = { id: number, name: string, committees: string[] }
/** The guests each guest wants to sit with, most wanted first. */
export type SeatingWishes = Record<number, number[]>
/** Each table is its seats in order, null where a seat is empty. */
export type SeatingPlan = { tables: (number | null)[][], unseated: number[] }
export type SeatPlace = { table: number, seat: number }
export type Nearness = 'beside' | 'across' | 'diagonal' | 'table'

export type SeatingPoints = {
    /** For each wish a guest gets, the nearest first. */
    wishes: number[],
    mutual: number,
    /** The share of a wish's points, in percent, by how near the two sit. */
    nearness: Record<Nearness, number>,
    /** Taken off for each table beyond the first that a committee sits at. */
    committeeSplit: number,
    /** Taken off per table for its empty seats, squared, so empty seats spread out. */
    emptySeat: number,
}

const UNSEATED_PENALTY = 100
const ITERATIONS = 300_000
const START_TEMPERATURE = 4
// Random swaps rarely help at a big dinner, so this share of them go to a seat near someone wished for.
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

/**
 * Tables are long, with the first half of the seats along one side and the rest along the other, so
 * seat k of each side face each other. An odd seat out goes to the first side.
 */
export function sidesOf(seats: number): number[][] {
    const length = Math.ceil(seats / 2)
    const all = Array.from({ length: seats }, (_, seat) => seat)
    return [all.slice(0, length), all.slice(length)]
}

function positionOf(seat: number, seats: number) {
    const length = Math.ceil(seats / 2)
    return { side: seat < length ? 0 : 1, column: seat < length ? seat : seat - length }
}

export function nearnessOf(first: number, second: number, seats: number): Nearness {
    const length = Math.ceil(seats / 2)
    const sameSide = first < length === second < length
    const apart = Math.abs((first < length ? first : first - length) - (second < length ? second : second - length))
    if (sameSide) return apart === 1 ? 'beside' : 'table'
    if (apart === 0) return 'across'
    return apart === 1 ? 'diagonal' : 'table'
}

export function placesOf(plan: SeatingPlan) {
    const places = new Map<number, SeatPlace>()
    plan.tables.forEach((table, index) => table.forEach((guestId, seat) => {
        if (guestId !== null) places.set(guestId, { table: index, seat })
    }))
    return places
}

/** The wishes a guest gets at their table, with how near each sits. */
function wishesAtTable(
    guestId: number,
    place: SeatPlace,
    seats: number,
    places: Map<number, SeatPlace>,
    wishes: SeatingWishes,
) {
    return (wishes[guestId] ?? []).flatMap(wished => {
        const wishedPlace = places.get(wished)
        if (wishedPlace?.table !== place.table) return []
        return [{ wished, nearness: nearnessOf(place.seat, wishedPlace.seat, seats) }]
    })
}

/**
 * The points of the wishes a guest gets. A swap only changes those of the two swapped and of who wished
 * for them, so only theirs are scored again. This runs for every swap tried, so it allocates nothing.
 */
function guestScore(
    guestId: number,
    places: Map<number, SeatPlace>,
    seats: number[],
    wishes: SeatingWishes,
    points: SeatingPoints,
) {
    const place = places.get(guestId)
    const wished = wishes[guestId] as number[] | undefined
    // Those without a seat sit at a table past the last one, where no wish counts.
    if (!place || !wished || place.table >= seats.length) return 0
    // The shares of the wishes met, kept nearest first, and how much of them comes back as mutual.
    let first = 0
    let second = 0
    let third = 0
    let mutual = 0
    for (const wishedId of wished) {
        const wishedPlace = places.get(wishedId)
        if (wishedPlace?.table !== place.table) continue
        const share = points.nearness[nearnessOf(place.seat, wishedPlace.seat, seats[place.table])] / 100
        if (wishes[wishedId]?.includes(guestId)) mutual += share
        if (share > first) {
            third = second
            second = first
            first = share
        } else if (share > second) {
            third = second
            second = share
        } else if (share > third) {
            third = share
        }
    }
    return (points.wishes[0] ?? 0) * first + (points.wishes[1] ?? 0) * second + (points.wishes[2] ?? 0) * third
        + points.mutual / 2 * mutual
}

/**
 * Finding the best plan is too slow, so this anneals: it swaps two random seats and keeps the swap
 * if the score rises, or sometimes if it falls, which gets ever rarer. That way it does not get
 * stuck on a plan no single swap improves. Locked guests stay in their seat.
 */
export function createSeatingPlan({ guests, wishes, seats, locked = {}, seed = 1, points = DEFAULT_SEATING_POINTS }: {
    guests: SeatingGuest[],
    wishes: SeatingWishes,
    seats: number[],
    locked?: Record<number, SeatPlace>,
    seed?: number,
    points?: SeatingPoints,
}): SeatingPlan {
    const committeesOf = new Map(guests.map(guest => [guest.id, guest.committees]))
    const random = seededRandom(seed)

    // Guests who do not fit sit at a last table, which is left out of the plan.
    const unseatedTable = seats.length
    const tables = [...seats, guests.length].map(count => Array<number | null>(count).fill(null))
    const lockedIds = new Set<number>()
    guests.forEach(({ id }) => {
        const place = locked[id] as SeatPlace | undefined
        if (place && place.table < unseatedTable && tables[place.table][place.seat] === null) {
            tables[place.table][place.seat] = id
            lockedIds.add(id)
        }
    })
    const free = guests.map(guest => guest.id).filter(id => !lockedIds.has(id))
    tables.forEach(table => table.forEach((guestId, seat) => {
        if (guestId === null && free.length > 0) table[seat] = free.shift() ?? null
    }))
    const places = placesOf({ tables, unseated: [] })

    // How many of each committee sit at each table, and at how many tables, so a split is scored at once.
    const spread = new Map<string, { counts: number[], tables: number }>()
    const count = (guestId: number | null, table: number, change: 1 | -1) => {
        if (guestId === null || table === unseatedTable) return
        committeesOf.get(guestId)?.forEach(committee => {
            const committeeSpread = spread.get(committee) ?? { counts: Array<number>(seats.length).fill(0), tables: 0 }
            committeeSpread.counts[table] += change
            if (change === 1 && committeeSpread.counts[table] === 1) committeeSpread.tables++
            if (change === -1 && committeeSpread.counts[table] === 0) committeeSpread.tables--
            spread.set(committee, committeeSpread)
        })
    }
    tables.forEach((table, index) => table.forEach(guestId => count(guestId, index, 1)))
    const splitScore = (committees: string[]) => committees.reduce(
        (score, committee) => score - points.committeeSplit * Math.max(0, (spread.get(committee)?.tables ?? 0) - 1),
        0,
    )

    const taken = tables.map(table => table.filter(guestId => guestId !== null).length)
    const emptyScore = (index: number) => (index === unseatedTable
        ? -UNSEATED_PENALTY * taken[index]
        : -points.emptySeat * (seats[index] - taken[index]) ** 2)

    // Whose score changes when a guest moves: theirs, and that of everyone who wished for them.
    const touched = new Map(guests.map(({ id }) => [id, [id]]))
    Object.entries(wishes).forEach(([id, wished]) => wished.forEach(wishedId => touched.get(wishedId)?.push(Number(id))))
    const touchedBy = (guestId: number | null) => (guestId === null ? [] : touched.get(guestId) ?? [])
    const touchedScore = (guestId: number | null, alreadyScored: number[] = []) => {
        let score = 0
        for (const id of touchedBy(guestId)) {
            if (!alreadyScored.includes(id)) score += guestScore(id, places, seats, wishes, points)
        }
        return score
    }

    const slots = tables
        .flatMap((table, index) => table.map((guestId, seat) => ({ guestId, table: index, seat })))
        .filter(({ guestId }) => guestId === null || !lockedIds.has(guestId))
        .map(({ table, seat }) => ({ table, seat }))
    // The free seats beside, across and diagonally from each seat.
    const nearSlots = tables.map((table, index) => table.map((_, seat) => (index === unseatedTable ? [] : slots.filter(
        slot => slot.table === index && slot.seat !== seat && nearnessOf(seat, slot.seat, table.length) !== 'table'
    ))))
    const guestAt = (slot: SeatPlace) => tables[slot.table][slot.seat]
    const pick = <Item, >(items: Item[]) => items[Math.floor(random() * items.length)]

    const pickSecond = (first: SeatPlace) => {
        const firstGuest = guestAt(first)
        const wished = firstGuest !== null && random() < AIMED_SHARE ? pick(wishes[firstGuest] ?? []) : undefined
        const place = wished === undefined ? undefined : places.get(wished)
        const near = place ? nearSlots[place.table][place.seat] : []
        return near.length === 0 ? pick(slots) : pick(near)
    }

    const swap = (first: SeatPlace, second: SeatPlace) => {
        const [firstGuest, secondGuest] = [guestAt(first), guestAt(second)]
        if (first.table !== second.table) {
            count(firstGuest, first.table, -1)
            count(secondGuest, second.table, -1)
            count(firstGuest, second.table, 1)
            count(secondGuest, first.table, 1)
            const moved = (secondGuest === null ? 0 : 1) - (firstGuest === null ? 0 : 1)
            taken[first.table] += moved
            taken[second.table] -= moved
        }
        tables[first.table][first.seat] = secondGuest
        tables[second.table][second.seat] = firstGuest
        if (secondGuest !== null) places.set(secondGuest, first)
        if (firstGuest !== null) places.set(firstGuest, second)
    }

    const cooling = (END_TEMPERATURE / START_TEMPERATURE) ** (1 / ITERATIONS)
    let temperature = START_TEMPERATURE
    for (let iteration = 0; iteration < ITERATIONS && slots.length > 1; iteration++) {
        temperature *= cooling
        const first = pick(slots)
        const second = pickSecond(first)
        const [firstGuest, secondGuest] = [guestAt(first), guestAt(second)]
        if (firstGuest === secondGuest) continue

        const sameTable = first.table === second.table
        const committees = sameTable ? [] : Array.from(new Set([firstGuest, secondGuest].flatMap(
            guestId => (guestId === null ? [] : committeesOf.get(guestId) ?? [])
        )))
        // Someone whose score both swapped guests change is counted once, or their change would weigh double.
        const score = () => touchedScore(firstGuest) + touchedScore(secondGuest, touchedBy(firstGuest))
            + (sameTable ? 0 : emptyScore(first.table) + emptyScore(second.table) + splitScore(committees))
        const before = score()
        swap(first, second)
        const change = score() - before
        if (change < 0 && random() >= Math.exp(change / temperature)) swap(first, second)
    }

    return {
        tables: tables.slice(0, unseatedTable),
        unseated: tables[unseatedTable].flatMap(guestId => (guestId === null ? [] : [guestId])),
    }
}

/** The wishes of a guest who sit beside, across or diagonally from them. */
export function fulfilledWishes(guestId: number, plan: SeatingPlan, wishes: SeatingWishes) {
    const places = placesOf(plan)
    const place = places.get(guestId)
    if (!place) return []
    return wishesAtTable(guestId, place, plan.tables[place.table].length, places, wishes)
        .flatMap(({ wished, nearness }) => (nearness === 'table' ? [] : [wished]))
}

export function seatingSummary(plan: SeatingPlan, guests: SeatingGuest[], wishes: SeatingWishes) {
    const wishing = guests.filter(guest => wishes[guest.id]?.length)
    const counts = wishing.map(guest => fulfilledWishes(guest.id, plan, wishes).length)

    const places = placesOf(plan)
    const committees = Array.from(new Set(guests.flatMap(guest => guest.committees)))
        .map(committee => guests.filter(guest => guest.committees.includes(committee)).map(guest => guest.id))
        .filter(members => members.length > 1)
    const together = committees.filter(members => (
        new Set(members.flatMap(id => places.get(id)?.table ?? [])).size <= 1
    ))

    return {
        wishing: wishing.length,
        gotAWish: counts.filter(count => count > 0).length,
        gotAllWishes: counts.filter((count, index) => count === wishes[wishing[index].id].length).length,
        committees: committees.length,
        committeesTogether: together.length,
    }
}

/** Two guests trading places, wherever they are sitting. */
export function swapGuests(plan: SeatingPlan, first: number, second: number): SeatingPlan {
    const trade = <Id extends number | null>(id: Id): Id | number => {
        if (id === first) return second
        return id === second ? first : id
    }
    return {
        tables: plan.tables.map(table => table.map(trade)),
        unseated: plan.unseated.map(trade),
    }
}

/** Moves a guest to a seat, trading with whoever sits there, or away from all tables with null. */
export function moveGuest(plan: SeatingPlan, guestId: number, place: SeatPlace | null): SeatingPlan {
    const there = place === null ? null : plan.tables[place.table][place.seat]
    if (there !== null) return swapGuests(plan, guestId, there)
    const tables = plan.tables.map(table => table.map(id => (id === guestId ? null : id)))
    const unseated = plan.unseated.filter(id => id !== guestId)
    if (place === null) return { tables, unseated: [...unseated, guestId] }
    tables[place.table][place.seat] = guestId
    return { tables, unseated }
}

export function firstEmptySeat(plan: SeatingPlan, table: number): SeatPlace | null {
    const seat = plan.tables[table].indexOf(null)
    return seat === -1 ? null : { table, seat }
}

/** Reads "5x8", or each table as "10, 10, 8", into the seats of each table. Null when it makes no sense. */
export function parseSeats(text: string): number[] | null {
    const seats: number[] = []
    for (const token of text.split(/[,;\s]+/).filter(Boolean)) {
        const match = /^(?:(\d+)[x*×])?(\d+)$/i.exec(token)
        if (!match || Number(match[2]) < 1 || Number(match[2]) > MAX_SEATS_PER_TABLE) return null
        const count = Number(match[1] ?? 1)
        if (seats.length + count > MAX_TABLES) return null
        seats.push(...Array<number>(count).fill(Number(match[2])))
    }
    return seats.length > 0 ? seats : null
}

export function displaySeats(seats: number[]) {
    return seats.every(count => count === seats[0]) ? `${seats.length}x${seats[0]}` : seats.join(', ')
}

/** Keeps who still has a seat on the same side and spot, so changing the tables does not undo the work. */
export function resizePlan(plan: SeatingPlan, seats: number[]): SeatingPlan {
    const tables = seats.map((count, index) => {
        const table = Array<number | null>(count).fill(null)
        const sides = sidesOf(count)
        const old = plan.tables.at(index) ?? []
        old.forEach((guestId, seat) => {
            const { side, column } = positionOf(seat, old.length)
            const newSeat = sides[side].at(column)
            if (newSeat !== undefined) table[newSeat] = guestId
        })
        return table
    })
    const seated = new Set(tables.flat())
    const dropped = plan.tables.flat().flatMap(id => (id === null || seated.has(id) ? [] : [id]))
    return { tables, unseated: [...plan.unseated, ...dropped] }
}

/** Fits a plan to who is registered now, which may have changed while it was being worked on. */
export function reconcilePlan(plan: SeatingPlan, guestIds: number[]): SeatingPlan {
    const present = new Set(guestIds)
    const tables = plan.tables.map(table => table.map(id => (id !== null && present.has(id) ? id : null)))
    const unseated = plan.unseated.filter(id => present.has(id))
    const placed = new Set([...tables.flat(), ...unseated])
    return { tables, unseated: [...unseated, ...guestIds.filter(id => !placed.has(id))] }
}
