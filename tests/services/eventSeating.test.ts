import { Session } from '@/auth/session/Session'
import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { eventOperations } from '@/services/events/operations'
import { eventSeatingOperations } from '@/services/events/seating/operations'
import { userOperations } from '@/services/users/operations'
import { describe, expect, test } from '@jest/globals'

const HOUR = 60 * 60 * 1000
const soon = new Date(Date.now() + 24 * HOUR)

async function setUp(key: string) {
    const order = (await prisma.omegaOrder.findFirstOrThrow({ orderBy: { order: 'desc' } })).order
    const group = await prisma.group.create({
        data: { groupType: 'MANUAL_GROUP', order, manualGroup: { create: { name: key, shortName: key } } },
    })
    const event = await eventOperations.create({
        data: {
            name: 'Julebord',
            location: 'Lophtet',
            eventStart: new Date(Date.now() + 48 * HOUR),
            eventEnd: new Date(Date.now() + 50 * HOUR),
            takesRegistration: false,
            visibilityAdminRequirements: [{ conditions: [{ type: 'ACTIVE', groupId: group.id }] }],
        },
        bypassAuth: true,
    })
    await eventOperations.saveSetup({
        params: { id: event.id },
        data: {
            variants: [{
                name: 'Påmelding',
                registrationStart: new Date(Date.now() - HOUR),
                registrationEnd: soon,
                takesPayment: false,
                quotas: [{ name: 'Alle', places: 3, visibilityRequirements: [] }],
            }],
        },
        bypassAuth: true,
    })
    await prisma.event.update({ where: { id: event.id }, data: { published: true, canBeViewedBy: 'ALL' } })
    const variant = await prisma.eventVariant.findFirstOrThrow({
        where: { eventId: event.id },
        select: { id: true, quotas: { select: { id: true } } },
    })
    const users = await Promise.all(['first', 'second', 'third', 'waiting'].map(name => userOperations.create({
        data: {
            email: `${key}-${name}@omega.ntnu.no`,
            firstname: name,
            lastname: 'Testesen',
            username: `${key}-${name}`,
            emailVerified: new Date().toISOString(),
        },
        bypassAuth: true,
    })))
    const quotaId = variant.quotas[0].id
    const seated = users.slice(0, 3).map(user => prisma.eventRegistration.create({
        data: { state: 'IN_QUOTA', quotaId, userId: user.id },
    }))
    const [first, second, third] = await Promise.all(seated)
    const waiting = await prisma.eventRegistration.create({
        data: { state: 'WAITING_LIST', waitingListVariantId: variant.id, userId: users[3].id },
    })
    const sessionOf = (index: number) => Session.fromJsObject({
        user: { id: users[index].id } as never,
        permissions: [],
        memberships: [],
    })
    return { params: { id: event.id }, first, second, third, waiting, sessionOf }
}

const expectRefused = (promise: Promise<unknown>) => expect(promise).rejects.toBeInstanceOf(Smorekopp)

describe('wishes', () => {
    test('are kept in the order given, and replaced by the next ones', async () => {
        const { params, first, second, third, sessionOf } = await setUp('seat-wish')
        await eventSeatingOperations.openWishes({ params, data: { wishesEnd: soon }, bypassAuth: true })
        const session = sessionOf(0)

        await eventSeatingOperations.updateWishes({ params, data: { wishes: [third.id, second.id] }, session })
        await eventSeatingOperations.updateWishes({ params, data: { wishes: [second.id, third.id] }, session })

        const own = await eventSeatingOperations.readOwn({ params, session })
        expect(own?.wishes).toEqual([second.id, third.id])
        expect(own?.options.map(({ id }) => id)).not.toContain(first.id)
    })

    test('cannot be for yourself or someone without a place', async () => {
        const { params, first, waiting, sessionOf } = await setUp('seat-refuse')
        await eventSeatingOperations.openWishes({ params, data: { wishesEnd: soon }, bypassAuth: true })

        const update = (id: number) => eventSeatingOperations.updateWishes({
            params,
            data: { wishes: [id] },
            session: sessionOf(0),
        })
        await expectRefused(update(first.id))
        await expectRefused(update(waiting.id))
    })

    test('need a place and an open deadline', async () => {
        const { params, second, sessionOf } = await setUp('seat-closed')
        const data = { wishes: [second.id] }

        const update = (index: number) => eventSeatingOperations.updateWishes({ params, data, session: sessionOf(index) })

        await expectRefused(update(0))

        await eventSeatingOperations.openWishes({ params, data: { wishesEnd: soon }, bypassAuth: true })
        await expectRefused(update(3))

        await prisma.event.update({ where: { id: params.id }, data: { seatingWishesEnd: new Date(Date.now() - HOUR) } })
        await expectRefused(update(0))
    })

    test('stop counting for someone who has lost their place', async () => {
        const { params, second, third, sessionOf } = await setUp('seat-stale')
        await eventSeatingOperations.openWishes({ params, data: { wishesEnd: soon }, bypassAuth: true })
        const session = sessionOf(0)
        await eventSeatingOperations.updateWishes({ params, data: { wishes: [second.id, third.id] }, session })

        const { variantId } = await prisma.eventQuota.findUniqueOrThrow({ where: { id: second.quotaId ?? 0 } })
        await prisma.eventRegistration.update({
            where: { id: second.id },
            data: { state: 'WAITING_LIST', quotaId: null, waitingListVariantId: variantId },
        })

        expect((await eventSeatingOperations.readOwn({ params, session }))?.wishes).toEqual([third.id])
        const board = await eventSeatingOperations.readBoard({ params, bypassAuth: true })
        expect(Object.values(board.wishes).flat()).not.toContain(second.id)
    })
})

describe('the plan', () => {
    test('is hidden from guests until it is published', async () => {
        const { params, first, second, third, sessionOf } = await setUp('seat-plan')
        await eventSeatingOperations.openWishes({ params, data: { wishesEnd: soon }, bypassAuth: true })
        await eventSeatingOperations.savePlan({
            params,
            data: {
                seats: [2, 2],
                placements: [
                    { registrationId: first.id, table: 1, locked: true },
                    { registrationId: second.id, table: 1, locked: false },
                    { registrationId: third.id, table: 0, locked: false },
                ],
            },
            bypassAuth: true,
        })

        expect((await eventSeatingOperations.readOwn({ params, session: sessionOf(0) }))?.table).toBeNull()

        await eventSeatingOperations.setPublished({ params, data: { published: true }, bypassAuth: true })
        const own = await eventSeatingOperations.readOwn({ params, session: sessionOf(0) })
        expect(own?.table).toEqual({ number: 2, guests: ['second Testesen'] })

        const board = await eventSeatingOperations.readBoard({ params, bypassAuth: true })
        expect(board.seats).toEqual([2, 2])
        expect(board.plan).toEqual({
            tables: [[third.id], [first.id, second.id].sort((earlier, later) => earlier - later)],
            unseated: [],
        })
        expect(board.locked).toEqual([first.id])
    })

    test('leaves those it does not place without a table when saved again', async () => {
        const { params, first } = await setUp('seat-again')
        const save = (table: number) => eventSeatingOperations.savePlan({
            params,
            data: { seats: [1, 1], placements: [{ registrationId: first.id, table, locked: false }] },
            bypassAuth: true,
        })
        await save(0)
        await save(1)
        const board = await eventSeatingOperations.readBoard({ params, bypassAuth: true })
        expect(board.plan.tables).toEqual([[], [first.id]])
        expect(board.plan.unseated).toHaveLength(2)
    })

    test('refuses a table with too many guests', async () => {
        const { params, first, second } = await setUp('seat-full')
        await expectRefused(eventSeatingOperations.savePlan({
            params,
            data: {
                seats: [1],
                placements: [
                    { registrationId: first.id, table: 0, locked: false },
                    { registrationId: second.id, table: 0, locked: false },
                ],
            },
            bypassAuth: true,
        }))
    })

    test('is only for those administrating the event', async () => {
        const { params, sessionOf } = await setUp('seat-admin')
        await expectRefused(eventSeatingOperations.readBoard({ params, session: sessionOf(0) }))
        await expectRefused(eventSeatingOperations.savePlan({
            params,
            data: { seats: [1], placements: [] },
            session: sessionOf(0),
        }))
    })
})
