import '@pn-server-only'
import { eventSeatingAuth } from './auth'
import { eventSeatingSchemas } from './schemas'
import { readEventAccess } from '@/services/events/access'
import { lockEvent } from '@/services/events/registration/queue'
import { omegaEventLinks } from '@/app/(omegaweb)/events/links'
import { ServiceError } from '@/services/error'
import { eventNotificationOperations } from '@/services/events/notifications/operations'
import { defineOperation, type PrismaPossibleTransaction } from '@/services/serviceOperation'
import type { OwnSeating, SeatingBoard } from './types'

/** Those with a place at the event. Someone in several variants still takes one seat. */
async function readSeatedRegistrations(prisma: PrismaPossibleTransaction<boolean>, eventId: number) {
    const registrations = await prisma.eventRegistration.findMany({
        where: { state: 'IN_QUOTA', quota: { variant: { eventId } } },
        orderBy: { id: 'asc' },
        select: {
            id: true,
            userId: true,
            tableId: true,
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

// The info channel, which those with a place are subscribed to.
function notifyGuests(
    event: { id: number, name: string, infoNotificationChannelId: number },
    userIds: number[],
    title: string,
    message: string,
) {
    if (userIds.length === 0) return null
    return eventNotificationOperations.internal.createInfoNotification.internalCall({
        params: { channelId: event.infoNotificationChannelId },
        data: { title, message, url: omegaEventLinks.event(event), audience: { userIds } },
    })
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
            const event = await prisma.event.findUniqueOrThrow({
                where: { id: params.id },
                select: {
                    seatingWishesEnd: true,
                    seatingPublishedAt: true,
                    seatingTables: { orderBy: { order: 'asc' }, select: { id: true, seats: true } },
                },
            })
            const registrations = await readSeatedRegistrations(prisma, params.id)
            const tableIds = event.seatingTables.map(table => table.id)

            return {
                wishesEnd: event.seatingWishesEnd,
                publishedAt: event.seatingPublishedAt,
                seats: event.seatingTables.map(table => table.seats),
                guests: registrations.map(({ id, name, user }) => ({
                    id,
                    name,
                    committees: user?.memberships.flatMap(({ group }) => group.committee?.name ?? []) ?? [],
                })),
                wishes: Object.fromEntries(registrations.map(({ id, seatingWishes }) => [
                    id,
                    seatingWishes.map(wish => wish.wishedRegistrationId),
                ])),
                plan: {
                    tables: tableIds.map(tableId => registrations.flatMap(
                        registration => (registration.tableId === tableId ? [registration.id] : [])
                    )),
                    unseated: registrations.flatMap(registration => (
                        registration.tableId !== null && tableIds.includes(registration.tableId) ? [] : [registration.id]
                    )),
                },
                locked: registrations.flatMap(registration => (registration.seatLocked ? [registration.id] : [])),
            }
        },
    }),

    readOwn: defineOperation({
        paramsSchema: eventSeatingSchemas.params.readOwn,
        authorizer: async ({ params, prisma }) => (
            eventSeatingAuth.readOwn.data(await readEventAccess(prisma, params.id))
        ),
        operation: async ({ prisma, params, session }): Promise<OwnSeating | null> => {
            const event = await prisma.event.findUniqueOrThrow({
                where: { id: params.id },
                select: {
                    seatingWishesEnd: true,
                    seatingPublishedAt: true,
                    seatingTables: { select: { id: true, order: true } },
                },
            })
            if (!event.seatingWishesEnd && !event.seatingPublishedAt) return null

            const registrations = await readSeatedRegistrations(prisma, params.id)
            const own = registrations.find(registration => registration.userId === session.user?.id)
            if (!own) return null

            const ownTable = event.seatingPublishedAt
                ? event.seatingTables.find(table => table.id === own.tableId)
                : undefined
            return {
                wishesEnd: event.seatingWishesEnd,
                options: registrations.flatMap(({ id, name }) => (id === own.id ? [] : [{ id, name }])),
                wishes: own.seatingWishes.map(wish => wish.wishedRegistrationId),
                table: ownTable ? {
                    number: ownTable.order + 1,
                    guests: registrations.flatMap(({ id, name, tableId }) => (
                        tableId === ownTable.id && id !== own.id ? [name] : []
                    )),
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
            const { seatingWishesEnd } = await prisma.event.findUniqueOrThrow({
                where: { id: params.id },
                select: { seatingWishesEnd: true },
            })
            if (!seatingWishesEnd || seatingWishesEnd < new Date()) {
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

            const event = await prisma.event.findUniqueOrThrow({
                where: { id: params.id },
                select: { id: true, name: true, infoNotificationChannelId: true, seatingWishesEnd: true },
            })
            await prisma.event.update({ where: { id: params.id }, data: { seatingWishesEnd: data.wishesEnd } })

            if (event.seatingWishesEnd) return
            await notifyGuests(
                event,
                userIdsOf(await readSeatedRegistrations(prisma, params.id)),
                'Hvem vil du sitte med?',
                `Du kan nå ønske deg hvem du vil sitte med på ${event.name}.`,
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

                // Someone may have lost their place since the plan was opened, which should not stop it being saved.
                const seated = (await readSeatedRegistrations(tx, params.id)).map(({ id }) => id)
                const placements = data.placements.filter(({ registrationId }) => seated.includes(registrationId))
                if (placements.some(({ table }) => table >= data.seats.length)) {
                    throw new ServiceError('BAD PARAMETERS', 'Noen er plassert ved et bord som ikke finnes')
                }

                await tx.eventTable.deleteMany({ where: { eventId: params.id } })
                await tx.eventRegistration.updateMany({
                    where: { quota: { variant: { eventId: params.id } }, seatLocked: true },
                    data: { seatLocked: false },
                })

                for (let order = 0; order < data.seats.length; order++) {
                    const seats = data.seats[order]
                    const atTable = placements.filter(({ table }) => table === order)
                    if (atTable.length > seats) {
                        throw new ServiceError('BAD PARAMETERS', `Bord ${order + 1} har for mange gjester`)
                    }
                    const { id } = await tx.eventTable.create({ data: { eventId: params.id, order, seats } })
                    await tx.eventRegistration.updateMany({
                        where: { id: { in: atTable.map(({ registrationId }) => registrationId) } },
                        data: { tableId: id },
                    })
                    await tx.eventRegistration.updateMany({
                        where: {
                            id: { in: atTable.filter(({ locked }) => locked).map(({ registrationId }) => registrationId) },
                        },
                        data: { seatLocked: true },
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
            const event = await prisma.event.update({
                where: { id: params.id },
                data: { seatingPublishedAt: data.published ? new Date() : null },
                select: { id: true, name: true, infoNotificationChannelId: true },
            })
            if (!data.published) return

            const registrations = await readSeatedRegistrations(prisma, params.id)
            await notifyGuests(
                event,
                userIdsOf(registrations.filter(registration => registration.tableId !== null)),
                'Bordplasseringen er klar',
                `Nå kan du se hvor du sitter på ${event.name}.`,
            )
        },
    }),
} as const
