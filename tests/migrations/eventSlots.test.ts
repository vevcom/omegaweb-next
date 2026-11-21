import { checksOf } from './checks'
import { prisma } from '@/prisma-pn-client-instance'
import { eventOperations } from '@/services/events/operations'
import { beforeAll, describe, expect, test } from '@jest/globals'
import { readFileSync } from 'node:fs'

const migration = readFileSync('src/prisma/migrations/20261126170000_event_slots/migration.sql', 'utf8')

let variantId: number

beforeAll(async () => {
    for (const check of checksOf(migration)) await prisma.$executeRawUnsafe(check)
    const event = await eventOperations.create({
        data: {
            kind: 'SPEED_INTERVIEW',
            name: 'Sjekker i databasen',
            eventStart: new Date('2027-01-20T09:00:00Z'),
            eventEnd: new Date('2027-01-20T12:00:00Z'),
            takesRegistration: true,
            visibilityAdminRequirements: [{ conditions: [] }],
        },
        bypassAuth: true,
    })
    variantId = (await prisma.eventVariant.findFirstOrThrow({ where: { eventId: event.id } })).id
})

describe('the checks of the slots migration', () => {
    test('are three, and in place', () => {
        expect(checksOf(migration)).toHaveLength(3)
    })

    test('refuse a slot that does not start before it ends', async () => {
        const start = new Date('2027-01-20T11:00:00Z')
        await expect(prisma.eventSlot.create({ data: { variantId, start, end: start } })).rejects.toThrow()
        await prisma.eventSlot.create({ data: { variantId, start, end: new Date('2027-01-20T11:10:00Z') } })
    })

    test('refuse a schedule with half a longer break, or minutes out of bounds', async () => {
        const schedule = {
            slotMinutes: 10,
            breakMinutes: 5,
            totalMinutes: 120,
            longBreakEveryMinutes: null as number | null,
            longBreakMinutes: null as number | null,
        }
        const write = (changes: Partial<typeof schedule>) => prisma.eventSlotSchedule.update({
            where: { variantId },
            data: { ...schedule, ...changes },
        })

        await expect(write({ longBreakEveryMinutes: 60 })).rejects.toThrow()
        await expect(write({ longBreakMinutes: 10 })).rejects.toThrow()
        await expect(write({ slotMinutes: 0 })).rejects.toThrow()
        await expect(write({ breakMinutes: -1 })).rejects.toThrow()
        await expect(write({ totalMinutes: 0 })).rejects.toThrow()
        await expect(write({ longBreakEveryMinutes: 0, longBreakMinutes: 10 })).rejects.toThrow()
        await expect(write({ longBreakEveryMinutes: 60, longBreakMinutes: 0 })).rejects.toThrow()

        await write({ breakMinutes: 0 })
        await write({ longBreakEveryMinutes: 60, longBreakMinutes: 10 })
    })
})
