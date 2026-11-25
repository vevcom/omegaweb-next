import { Session } from '@/auth/session/Session'
import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { eventOperations } from '@/services/events/operations'
import { eventRegistrationOperations } from '@/services/events/registration/operations'
import { eventSeatingOperations } from '@/services/events/seating/operations'
import { userOperations } from '@/services/users/operations'
import { createAdministrators } from 'tests/eventSetup'
import { describe, expect, test } from '@jest/globals'

const HOUR = 60 * 60 * 1000
const soon = new Date(Date.now() + 24 * HOUR)

async function setUp(key: string) {
    const event = await eventOperations.create({
        data: {
            name: 'Julebord',
            location: 'Lophtet',
            eventStart: new Date(Date.now() + 48 * HOUR),
            eventEnd: new Date(Date.now() + 50 * HOUR),
            takesRegistration: false,
            canBeViewedBy: 'ALL',
            visibilityAdminRequirements: await createAdministrators(key),
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
                quotas: [
                    { name: 'Alle', places: 3, visibilityRequirements: [] },
                    { name: 'Ekstra', places: 1, visibilityRequirements: [] },
                ],
            }],
        },
        bypassAuth: true,
    })
    await eventOperations.setPublished({ params: { id: event.id }, data: { published: true }, bypassAuth: true })
    const variant = await prisma.eventVariant.findFirstOrThrow({
        where: { eventId: event.id },
        select: { id: true, quotas: { orderBy: { name: 'asc' }, select: { id: true } } },
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
    return { params: { id: event.id }, first, second, third, waiting, sessionOf, extraQuotaId: variant.quotas[1].id }
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

        await prisma.eventSeating.update({ where: { eventId: params.id }, data: { wishesEnd: new Date(Date.now() - HOUR) } })
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

test('opening the wishes and publishing leave the version of the setup form alone', async () => {
    const { params } = await setUp('seat-setup')
    const updatedAt = async () => (await prisma.event.findUniqueOrThrow({ where: { id: params.id } })).updatedAt
    const before = await updatedAt()

    await eventSeatingOperations.openWishes({ params, data: { wishesEnd: soon }, bypassAuth: true })
    await eventSeatingOperations.setPublished({ params, data: { published: true }, bypassAuth: true })

    expect(await updatedAt()).toEqual(before)
})

describe('the plan', () => {
    test('is hidden from guests until it is published', async () => {
        const { params, first, second, third, sessionOf } = await setUp('seat-plan')
        await eventSeatingOperations.openWishes({ params, data: { wishesEnd: soon }, bypassAuth: true })
        await eventSeatingOperations.savePlan({
            params,
            data: {
                version: 0,
                seats: [2, 2],
                placements: [
                    { registrationId: first.id, table: 1, seat: 0, locked: true },
                    { registrationId: second.id, table: 1, seat: 1, locked: false },
                    { registrationId: third.id, table: 0, seat: 1, locked: false },
                ],
            },
            bypassAuth: true,
        })

        const unpublished = await eventSeatingOperations.readOwn({ params, session: sessionOf(0) })
        expect(unpublished).toMatchObject({ table: null, published: false })

        await eventSeatingOperations.setPublished({ params, data: { published: true }, bypassAuth: true })
        const own = await eventSeatingOperations.readOwn({ params, session: sessionOf(0) })
        expect(own?.table).toEqual({ number: 2, seats: ['first Testesen', 'second Testesen'], ownSeat: 0 })
        expect(own?.published).toBe(true)

        const board = await eventSeatingOperations.readBoard({ params, bypassAuth: true })
        expect(board.seats).toEqual([2, 2])
        expect(board.plan).toEqual({
            tables: [[null, third.id], [first.id, second.id]],
            unseated: [],
        })
        expect(board.locked).toEqual([first.id])
    })

    test('leaves those it does not place without a table when saved again', async () => {
        const { params, first } = await setUp('seat-again')
        const save = async (table: number, version?: number) => eventSeatingOperations.savePlan({
            params,
            data: {
                seats: [1, 1],
                placements: [{ registrationId: first.id, table, seat: 0, locked: false }],
                version: version ?? (await eventSeatingOperations.readBoard({ params, bypassAuth: true })).version,
            },
            bypassAuth: true,
        })
        await save(0)
        await save(1)
        const board = await eventSeatingOperations.readBoard({ params, bypassAuth: true })
        expect(board.plan.tables).toEqual([[null], [first.id]])
        expect(board.plan.unseated).toHaveLength(2)
    })

    test('refuses a save from a board someone else has since saved', async () => {
        const { params, first } = await setUp('seat-version')
        const placements = [{ registrationId: first.id, table: 0, seat: 0, locked: false }]
        await eventSeatingOperations.savePlan({ params, data: { seats: [1], placements, version: 0 }, bypassAuth: true })
        await expectRefused(eventSeatingOperations.savePlan({
            params,
            data: { seats: [1], placements: [], version: 0 },
            bypassAuth: true,
        }))
        expect((await eventSeatingOperations.readBoard({ params, bypassAuth: true })).plan.tables).toEqual([[first.id]])
    })

    test('follows someone in several variants when the registration they sit on is removed', async () => {
        const { params, first, second, sessionOf, extraQuotaId } = await setUp('seat-heir')
        const other = await prisma.eventRegistration.create({
            data: { state: 'IN_QUOTA', quotaId: extraQuotaId, userId: first.userId },
        })
        await eventSeatingOperations.openWishes({ params, data: { wishesEnd: soon }, bypassAuth: true })
        await eventSeatingOperations.updateWishes({ params, data: { wishes: [second.id] }, session: sessionOf(0) })
        await eventSeatingOperations.updateWishes({ params, data: { wishes: [first.id] }, session: sessionOf(1) })
        await eventSeatingOperations.savePlan({
            params,
            data: {
                version: 0,
                seats: [2],
                placements: [
                    { registrationId: first.id, table: 0, seat: 0, locked: true },
                    { registrationId: second.id, table: 0, seat: 1, locked: false },
                ],
            },
            bypassAuth: true,
        })

        await eventRegistrationOperations.destroyAsAdmin({ params: { registrationId: first.id }, bypassAuth: true })

        const board = await eventSeatingOperations.readBoard({ params, bypassAuth: true })
        expect(board.plan.tables).toEqual([[other.id, second.id]])
        expect(board.locked).toEqual([other.id])
        expect(board.wishes[other.id]).toEqual([second.id])
        expect(board.wishes[second.id]).toEqual([other.id])
    })

    test('leaves the seat empty when the one who sat there is removed', async () => {
        const { params, first, second } = await setUp('seat-left')
        await eventSeatingOperations.savePlan({
            params,
            data: {
                version: 0,
                seats: [2],
                placements: [
                    { registrationId: first.id, table: 0, seat: 0, locked: false },
                    { registrationId: second.id, table: 0, seat: 1, locked: false },
                ],
            },
            bypassAuth: true,
        })

        await eventRegistrationOperations.destroyAsAdmin({ params: { registrationId: first.id }, bypassAuth: true })

        const board = await eventSeatingOperations.readBoard({ params, bypassAuth: true })
        expect(board.plan.tables).toEqual([[null, second.id]])
    })

    test('refuses two guests in one seat', async () => {
        const { params, first, second } = await setUp('seat-full')
        await expectRefused(eventSeatingOperations.savePlan({
            params,
            data: {
                seats: [1],
                placements: [
                    { registrationId: first.id, table: 0, seat: 0, locked: false },
                    { registrationId: second.id, table: 0, seat: 0, locked: false },
                ],
                version: 0,
            },
            bypassAuth: true,
        }))
        await expectRefused(eventSeatingOperations.savePlan({
            params,
            data: { seats: [1], placements: [{ registrationId: first.id, table: 0, seat: 1, locked: false }], version: 0 },
            bypassAuth: true,
        }))
    })

    test('is only for those administrating the event', async () => {
        const { params, sessionOf } = await setUp('seat-admin')
        await expectRefused(eventSeatingOperations.readBoard({ params, session: sessionOf(0) }))
        await expectRefused(eventSeatingOperations.savePlan({
            params,
            data: { seats: [1], placements: [], version: 0 },
            session: sessionOf(0),
        }))
    })
})
