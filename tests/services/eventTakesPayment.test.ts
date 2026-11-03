import { prisma } from '@/prisma/client'
import { eventOperations } from '@/services/events/operations'
import { describe, expect, test } from '@jest/globals'

const dayMs = 24 * 60 * 60 * 1000

function eventData(payment: { takesPayment?: boolean, price?: number }) {
    return {
        name: 'Test takes payment',
        location: 'Lophtet',
        eventStart: new Date(Date.now() + dayMs),
        eventEnd: new Date(Date.now() + 2 * dayMs),
        canBeViewedBy: 'ALL' as const,
        takesRegistration: true,
        places: 10,
        waitingList: false,
        paymentStart: new Date(Date.now() - dayMs),
        paymentEnd: new Date(Date.now() + dayMs),
        tagIds: [],
        visibilityAdminRequirements: [{ conditions: [] }],
        ...payment,
    }
}

describe('events taking payment', () => {
    test('an event that takes no payment keeps no price', async () => {
        const event = await eventOperations.create({ data: eventData({ price: 100 }), bypassAuth: true })

        await expect(prisma.event.findUniqueOrThrow({ where: { id: event.id } })).resolves.toMatchObject({
            takesPayment: false, price: null, paymentStart: null, paymentEnd: null,
        })
    })

    test('an event that takes payment must have a price', async () => {
        await expect(eventOperations.create({
            data: eventData({ takesPayment: true }),
            bypassAuth: true,
        })).rejects.toThrow()
    })

    test('turning payment off clears the price and the payment period', async () => {
        const event = await eventOperations.create({
            data: eventData({ takesPayment: true, price: 100 }),
            bypassAuth: true,
        })
        await expect(prisma.event.findUniqueOrThrow({ where: { id: event.id } }))
            .resolves.toMatchObject({ takesPayment: true, price: 10000 })

        await eventOperations.update({ params: { id: event.id }, data: { takesPayment: false }, bypassAuth: true })

        await expect(prisma.event.findUniqueOrThrow({ where: { id: event.id } })).resolves.toMatchObject({
            takesPayment: false, price: null, paymentStart: null, paymentEnd: null,
        })
    })
})
