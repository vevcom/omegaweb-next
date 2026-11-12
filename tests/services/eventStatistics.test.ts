import { Session } from '@/auth/session/Session'
import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { eventOperations } from '@/services/events/operations'
import { userOperations } from '@/services/users/operations'
import { describe, expect, test } from '@jest/globals'

const HOUR = 60 * 60 * 1000
const registrationStart = new Date(Date.now() - 10 * HOUR)

async function setUp() {
    const order = (await prisma.omegaOrder.findFirstOrThrow({ orderBy: { order: 'desc' } })).order
    const group = await prisma.group.create({
        data: { groupType: 'MANUAL_GROUP', order, manualGroup: { create: { name: 'stats', shortName: 'stats' } } },
    })
    const event = await eventOperations.create({
        data: {
            name: 'Statistikk',
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
                registrationStart,
                registrationEnd: new Date(Date.now() + 24 * HOUR),
                takesPayment: false,
                quotas: [{ name: 'Alle', places: 2, visibilityRequirements: [] }],
            }],
        },
        bypassAuth: true,
    })
    const variant = await prisma.eventVariant.findFirstOrThrow({
        where: { eventId: event.id },
        select: { id: true, quotas: { select: { id: true } } },
    })
    const users = await Promise.all(['first', 'second', 'third'].map(name => userOperations.create({
        data: {
            email: `event-stats-${name}@omega.ntnu.no`,
            firstname: 'Test',
            lastname: 'Testesen',
            username: `event-stats-${name}`,
            emailVerified: new Date().toISOString(),
        },
        bypassAuth: true,
    })))
    const quotaId = variant.quotas[0].id
    await prisma.eventRegistration.createMany({
        data: [
            { state: 'IN_QUOTA', quotaId, userId: users[1].id, createdAt: new Date(Date.now() - 8 * HOUR) },
            {
                state: 'WAITING_LIST',
                waitingListVariantId: variant.id,
                userId: users[2].id,
                createdAt: new Date(Date.now() - 7 * HOUR),
            },
            {
                state: 'IN_QUOTA',
                quotaId,
                userId: users[0].id,
                createdAt: new Date(Date.now() - 9 * HOUR),
                attendedAt: new Date(),
            },
        ],
    })
    return { eventId: event.id, groupId: group.id, order }
}

describe('eventOperations.readStatistics', () => {
    test('counts a variant, with the registrations in the order they came', async () => {
        const { eventId, groupId, order } = await setUp()
        const [variant, ...others] = await eventOperations.readStatistics({ params: { id: eventId }, bypassAuth: true })

        expect(others).toHaveLength(0)
        expect(variant).toMatchObject({ places: 2, inQuota: 2, waiting: 1, paid: null, attended: 1 })
        expect(variant.lastSeatedAt).toEqual(variant.registeredAt[1])
        expect(variant.registeredAt).toEqual([...variant.registeredAt].sort((one, other) => one.getTime() - other.getTime()))
        expect(variant.registeredAt).toHaveLength(3)

        const session = (active: boolean) => Session.fromJsObject({
            user: null,
            permissions: [],
            memberships: active ? [{ groupId, order, active, admin: false }] : [],
        })
        await expect(eventOperations.readStatistics({ params: { id: eventId }, session: session(true) }))
            .resolves.toHaveLength(1)
        await expect(eventOperations.readStatistics({ params: { id: eventId }, session: session(false) }))
            .rejects.toThrow(Smorekopp)
    })
})
