import '@pn-server-only'
import { eventSeatingAuth } from './auth'
import { eventSeatingSchemas } from './schemas'
import { placesOf } from './plan'
import { readEventAccess } from '@/services/events/access'
import { lockEvent, seatedInEvent } from '@/services/events/registration/queue'
import { omegaEventLinks } from '@/app/(omegaweb)/events/links'
import { ServiceError } from '@/services/error'
import { eventNotificationOperations } from '@/services/events/notifications/operations'
import { defineOperation, type PrismaPossibleTransaction } from '@/services/serviceOperation'
import type { OwnSeating, SeatingBoard } from './types'
import type { SeatingPlan } from './plan'

/** Those with a place at the event. Someone in several variants still takes one seat. */
async function readSeatedRegistrations(prisma: PrismaPossibleTransaction<boolean>, eventId: number) {
    const registrations = await prisma.eventRegistration.findMany({
        where: seatedInEvent(eventId),
        orderBy: { id: 'asc' },
        select: {
            id: true,
            userId: true,
            tableId: true,
            seat: true,
            seatLocked: true,
            contact: { select: { name: true } },
            seatingWishes: { orderBy: { rank: 'asc' }, select: { wishedRegistrationId: true } },
            user: {
                select: {
                    firstname: true,
                    lastname: true,
                    memberships: {
                        where: { active: true, group: { committee: { isNot: null } } },
                        select: { group: { select: { committee: { select: { name: true } } } } },
                    },
                },
            },
        },
    })
    const seen = new Set<number>()
    const seated = registrations.filter(({ userId }) => {
        if (userId === null) return true
        if (seen.has(userId)) return false
        seen.add(userId)
        return true
    })
    // A wish for someone who has since lost their place stays in the database but no longer counts.
    const seatedIds = new Set(seated.map(({ id }) => id))
    return seated.map(registration => ({
        ...registration,
        seatingWishes: registration.seatingWishes.filter(wish => seatedIds.has(wish.wishedRegistrationId)),
        name: registration.user
            ? `${registration.user.firstname} ${registration.user.lastname}`
            : registration.contact?.name ?? 'Ukjent',
    }))
}

/** When the wishes close and when the tables were published. An event without a row has neither. */
async function readSeating(prisma: PrismaPossibleTransaction<boolean>, eventId: number) {
    const seating = await prisma.eventSeating.findUnique({
        where: { eventId },
        select: { wishesEnd: true, publishedAt: true },
    })
    return seating ?? { wishesEnd: null, publishedAt: null }
}

function readTables(prisma: PrismaPossibleTransaction<boolean>, eventId: number) {
    return prisma.eventTable.findMany({ where: { eventId }, orderBy: { order: 'asc' }, select: { id: true, seats: true } })
}

// The info channel, which those with a place are subscribed to.
async function notifyGuests(
    prisma: PrismaPossibleTransaction<boolean>,
    eventId: number,
    userIds: number[],
    title: string,
    message: (eventName: string) => string,
) {
    if (userIds.length === 0) return
    const event = await prisma.event.findUniqueOrThrow({
        where: { id: eventId },
        select: { id: true, name: true, infoNotificationChannelId: true },
    })
    await eventNotificationOperations.internal.createInfoNotification.internalCall({
        params: { channelId: event.infoNotificationChannelId },
        data: { title, message: message(event.name), url: omegaEventLinks.event(event), audience: { userIds } },
    })
}

/** Who sits where. A registration without a seat at one of the tables is left without a table. */
function planOf(
    tables: { id: number, seats: number }[],
    registrations: { id: number, tableId: number | null, seat: number | null }[],
): SeatingPlan {
    const plan: SeatingPlan = { tables: tables.map(table => Array<number | null>(table.seats).fill(null)), unseated: [] }
    registrations.forEach(({ id, tableId, seat }) => {
        const index = tables.findIndex(table => table.id === tableId)
        if (index === -1 || seat === null || seat >= tables[index].seats) plan.unseated.push(id)
        else plan.tables[index][seat] = id
    })
    return plan
}

const userIdsOf = (registrations: { userId: number | null }[]) => (
    registrations.flatMap(({ userId }) => (userId === null ? [] : [userId]))
)

export const eventSeatingOperations = {
    readBoard: defineOperation({
        paramsSchema: eventSeatingSchemas.params.readBoard,
        authorizer: async ({ params, prisma }) => (
            eventSeatingAuth.readBoard.data(await readEventAccess(prisma, params.id))
        ),
        operation: async ({ prisma, params }): Promise<SeatingBoard> => {
            const seating = await readSeating(prisma, params.id)
            const tables = await readTables(prisma, params.id)
            const registrations = await readSeatedRegistrations(prisma, params.id)

            return {
                ...seating,
                seats: tables.map(table => table.seats),
                guests: registrations.map(({ id, name, user }) => ({
                    id,
                    name,
                    committees: user?.memberships.flatMap(({ group }) => group.committee?.name ?? []) ?? [],
                })),
                wishes: Object.fromEntries(registrations.map(({ id, seatingWishes }) => [
                    id,
                    seatingWishes.map(wish => wish.wishedRegistrationId),
                ])),
                plan: planOf(tables, registrations),
                locked: registrations.flatMap(registration => (registration.seatLocked ? [registration.id] : [])),
                version: Math.max(0, ...tables.map(table => table.id)),
            }
        },
    }),

    readOwn: defineOperation({
        paramsSchema: eventSeatingSchemas.params.readOwn,
        authorizer: async ({ params, prisma }) => (
            eventSeatingAuth.readOwn.data(await readEventAccess(prisma, params.id))
        ),
        operation: async ({ prisma, params, session }): Promise<OwnSeating | null> => {
            const { wishesEnd, publishedAt } = await readSeating(prisma, params.id)
            if (!wishesEnd && !publishedAt) return null

            const registrations = await readSeatedRegistrations(prisma, params.id)
            const own = registrations.find(registration => registration.userId === session.user?.id)
            if (!own) return null

            const plan = planOf(await readTables(prisma, params.id), registrations)
            const place = publishedAt ? placesOf(plan).get(own.id) : undefined
            const nameOf = (id: number | null) => registrations.find(registration => registration.id === id)?.name ?? null
            return {
                wishesEnd,
                options: registrations.flatMap(({ id, name }) => (id === own.id ? [] : [{ id, name }])),
                wishes: own.seatingWishes.map(wish => wish.wishedRegistrationId),
                published: publishedAt !== null,
                table: place ? {
                    number: place.table + 1,
                    seats: plan.tables[place.table].map(nameOf),
                    ownSeat: place.seat,
                } : null,
            }
        },
    }),

    updateWishes: defineOperation({
        paramsSchema: eventSeatingSchemas.params.updateWishes,
        dataSchema: eventSeatingSchemas.data.updateWishes,
        authorizer: async ({ params, prisma }) => (
            eventSeatingAuth.updateWishes.data(await readEventAccess(prisma, params.id))
        ),
        transaction: 'OPENS',
        operation: async ({ prisma, params, data, session }) => {
            const { wishesEnd } = await readSeating(prisma, params.id)
            if (!wishesEnd || wishesEnd < new Date()) {
                throw new ServiceError('BAD PARAMETERS', 'Fristen for å sende ønsker er ute')
            }

            const registrations = await readSeatedRegistrations(prisma, params.id)
            const own = registrations.find(registration => registration.userId === session.user?.id)
            if (!own) throw new ServiceError('BAD PARAMETERS', 'Bare de med plass på arrangementet kan sende ønsker')

            const options = registrations.filter(registration => registration.id !== own.id).map(({ id }) => id)
            const wishes = data.wishes.filter((id, index) => data.wishes.indexOf(id) === index)
            if (wishes.some(id => !options.includes(id))) {
                throw new ServiceError('BAD PARAMETERS', 'Du kan bare ønske deg andre med plass på arrangementet')
            }

            await prisma.$transaction([
                prisma.eventSeatingWish.deleteMany({ where: { registrationId: own.id } }),
                prisma.eventSeatingWish.createMany({
                    data: wishes.map((wishedRegistrationId, rank) => ({
                        registrationId: own.id,
                        wishedRegistrationId,
                        rank,
                    })),
                }),
            ])
        },
    }),

    openWishes: defineOperation({
        paramsSchema: eventSeatingSchemas.params.openWishes,
        dataSchema: eventSeatingSchemas.data.openWishes,
        authorizer: async ({ params, prisma }) => (
            eventSeatingAuth.openWishes.data(await readEventAccess(prisma, params.id))
        ),
        operation: async ({ prisma, params, data }) => {
            if (data.wishesEnd < new Date()) throw new ServiceError('BAD PARAMETERS', 'Fristen må være frem i tid')

            const before = await readSeating(prisma, params.id)
            await prisma.eventSeating.upsert({
                where: { eventId: params.id },
                create: { eventId: params.id, wishesEnd: data.wishesEnd },
                update: { wishesEnd: data.wishesEnd },
            })

            if (before.wishesEnd) return
            await notifyGuests(
                prisma,
                params.id,
                userIdsOf(await readSeatedRegistrations(prisma, params.id)),
                'Hvem vil du sitte med?',
                eventName => `Du kan nå ønske deg hvem du vil sitte med på ${eventName}.`,
            )
        },
    }),

    savePlan: defineOperation({
        paramsSchema: eventSeatingSchemas.params.savePlan,
        dataSchema: eventSeatingSchemas.data.savePlan,
        authorizer: async ({ params, prisma }) => (
            eventSeatingAuth.savePlan.data(await readEventAccess(prisma, params.id))
        ),
        transaction: 'OPENS',
        operation: async ({ prisma, params, data }) => {
            await prisma.$transaction(async tx => {
                await lockEvent(tx, params.id)
                // Every save makes new tables, so the newest table id tells whether the board is stale.
                const newest = await tx.eventTable.aggregate({ where: { eventId: params.id }, _max: { id: true } })
                if ((newest._max.id ?? 0) !== data.version) {
                    throw new ServiceError(
                        'BAD PARAMETERS',
                        'Noen andre har lagret bordene siden du åpnet dem. Last inn siden på nytt.',
                    )
                }

                // Someone may have lost their place since the plan was opened, which should not stop it being saved.
                const seated = (await readSeatedRegistrations(tx, params.id)).map(({ id }) => id)
                const placements = data.placements.filter(({ registrationId }) => seated.includes(registrationId))
                const seatsTaken = new Set<string>()
                const guestsPlaced = new Set<number>()
                for (const { registrationId, table, seat } of placements) {
                    if (table >= data.seats.length || seat >= data.seats[table]) {
                        throw new ServiceError('BAD PARAMETERS', 'Noen er plassert på en plass som ikke finnes')
                    }
                    if (seatsTaken.has(`${table}:${seat}`) || guestsPlaced.has(registrationId)) {
                        throw new ServiceError('BAD PARAMETERS', 'Hver plass og hver gjest kan bare brukes én gang')
                    }
                    seatsTaken.add(`${table}:${seat}`)
                    guestsPlaced.add(registrationId)
                }

                await tx.eventRegistration.updateMany({
                    where: { table: { eventId: params.id } },
                    data: { seat: null, seatLocked: false },
                })
                await tx.eventTable.deleteMany({ where: { eventId: params.id } })
                const tables = await tx.eventTable.createManyAndReturn({
                    data: data.seats.map((seats, order) => ({ eventId: params.id, order, seats })),
                    select: { id: true, order: true },
                })
                const tableIdOf = new Map(tables.map(({ id, order }) => [order, id]))
                for (const { registrationId, table, seat, locked } of placements) {
                    await tx.eventRegistration.update({
                        where: { id: registrationId },
                        data: { tableId: tableIdOf.get(table), seat, seatLocked: locked },
                    })
                }
            })
        },
    }),

    setPublished: defineOperation({
        paramsSchema: eventSeatingSchemas.params.setPublished,
        dataSchema: eventSeatingSchemas.data.setPublished,
        authorizer: async ({ params, prisma }) => (
            eventSeatingAuth.setPublished.data(await readEventAccess(prisma, params.id))
        ),
        operation: async ({ prisma, params, data }) => {
            const publishedAt = data.published ? new Date() : null
            await prisma.eventSeating.upsert({
                where: { eventId: params.id },
                create: { eventId: params.id, publishedAt },
                update: { publishedAt },
            })
            if (!data.published) return

            const registrations = await readSeatedRegistrations(prisma, params.id)
            await notifyGuests(
                prisma,
                params.id,
                userIdsOf(registrations.filter(registration => registration.tableId !== null)),
                'Bordplasseringen er klar',
                eventName => `Nå kan du se hvor du sitter på ${eventName}.`,
            )
        },
    }),
} as const
