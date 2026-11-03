import { prisma } from '@/prisma/client'
import { eventOperations } from '@/services/events/operations'
import { eventVariantOperations } from '@/services/events/variants/operations'
import { describe, expect, test } from '@jest/globals'

const dayMs = 24 * 60 * 60 * 1000

/** Payment is the variant's: the one the event was created with. */
const variantOf = (eventId: number) => prisma.eventVariant.findFirstOrThrow({ where: { eventId } })

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

describe('variants taking payment', () => {
    test('a variant that takes no payment keeps no price', async () => {
        const event = await eventOperations.create({ data: eventData({ price: 100 }), bypassAuth: true })

        await expect(variantOf(event.id)).resolves.toMatchObject({
            takesPayment: false, price: null, paymentStart: null, paymentEnd: null,
        })
    })

    test('a variant that takes payment must have a price', async () => {
        await expect(eventOperations.create({
            data: eventData({ takesPayment: true }),
            bypassAuth: true,
        })).rejects.toThrow()

        const event = await eventOperations.create({ data: eventData({}), bypassAuth: true })
        const variant = await variantOf(event.id)
        await expect(eventVariantOperations.update({
            params: { id: variant.id }, data: { takesPayment: true }, bypassAuth: true,
        })).rejects.toThrow()
    })

    test('payment is turned on with its price, and turning it off clears the price and the period', async () => {
        const event = await eventOperations.create({ data: eventData({}), bypassAuth: true })
        const variant = await variantOf(event.id)

        await eventVariantOperations.update({
            params: { id: variant.id },
            data: {
                takesPayment: true,
                price: 100,
                paymentStart: new Date(Date.now() - dayMs),
                paymentEnd: new Date(Date.now() + dayMs),
            },
            bypassAuth: true,
        })
        await expect(variantOf(event.id)).resolves.toMatchObject({ takesPayment: true, price: 10000 })

        await eventVariantOperations.update({ params: { id: variant.id }, data: { takesPayment: false }, bypassAuth: true })

        await expect(variantOf(event.id)).resolves.toMatchObject({
            takesPayment: false, price: null, paymentStart: null, paymentEnd: null,
        })
    })
})
