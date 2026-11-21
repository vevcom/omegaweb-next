import { checksOf } from './checks'
import { prisma } from '@/prisma-pn-client-instance'
import { eventOperations } from '@/services/events/operations'
import { userOperations } from '@/services/users/operations'
import { beforeAll, describe, expect, test } from '@jest/globals'
import { readFileSync } from 'node:fs'

const migration = readFileSync('src/prisma/migrations/20261126180000_event_registration_slot/migration.sql', 'utf8')

let variantId: number
let quotaId: number
let slotIds: number[]
let userIds: number[]

beforeAll(async () => {
    for (const check of checksOf(migration)) await prisma.$executeRawUnsafe(check)
    const event = await eventOperations.create({
        data: {
            kind: 'SPEED_INTERVIEW',
            name: 'Tidsluker i databasen',
            eventStart: new Date('2027-01-20T09:00:00Z'),
            eventEnd: new Date('2027-01-20T12:00:00Z'),
            takesRegistration: true,
            visibilityAdminRequirements: [{ conditions: [] }],
        },
        bypassAuth: true,
    })
    const variant = await prisma.eventVariant.findFirstOrThrow({
        where: { eventId: event.id },
        include: { quotas: true, slots: { orderBy: { start: 'asc' } } },
    })
    variantId = variant.id
    quotaId = variant.quotas[0].id
    slotIds = variant.slots.map(slot => slot.id)
    userIds = (await Promise.all(['first', 'second'].map(name => userOperations.create({
        data: {
            email: `slot-check-${name}@omega.ntnu.no`,
            firstname: 'Test',
            lastname: 'Testesen',
            username: `slot-check-${name}`,
            emailVerified: new Date().toISOString(),
        },
        bypassAuth: true,
    })))).map(user => user.id)
})

describe('the check of the registration slot migration', () => {
    test('is one, and in place', () => {
        expect(checksOf(migration)).toHaveLength(1)
    })

    test('refuses a slot to a registration on the waiting list, and gives one to a registration with a place', async () => {
        await expect(prisma.eventRegistration.create({
            data: { state: 'WAITING_LIST', waitingListVariantId: variantId, userId: userIds[0], slotId: slotIds[0] },
        })).rejects.toThrow()

        await prisma.eventRegistration.create({
            data: { state: 'IN_QUOTA', quotaId, userId: userIds[1], slotId: slotIds[0] },
        })
        await expect(prisma.eventSlot.delete({ where: { id: slotIds[0] } })).rejects.toThrow()
    })
})
