import {
    calculateCabinBookingPrice,
    calculateTotalCabinBookingPrice,
} from '@/services/cabin/booking/cabinPriceCalculator'
import { describe, expect, test } from '@jest/globals'
import type { CabinProductExtended } from '@/services/cabin/product/constants'
import type { PricePeriod } from '@/prisma-generated-pn-types'

const date = (day: string) => new Date(`${day}T00:00:00Z`)

// The calculator picks the last period that has started, so the periods are given in the order
// they start.
const spring: PricePeriod = { id: 1, validFrom: date('2026-01-01') }
const summer: PricePeriod = { id: 2, validFrom: date('2026-06-01') }
const pricePeriods = [spring, summer]

// Day of week in the cron intervals: 0 is Sunday.
const SUNDAY_TO_THURSDAY = '* * 0-4'
const FRIDAY_AND_SATURDAY = '* * 5-6'

let nextPriceId = 1

function price(pricePeriod: PricePeriod, cronInterval: string, amount: number, memberShare = 0) {
    return {
        id: nextPriceId++,
        description: `${cronInterval} ${memberShare}`,
        cabinProductId: 0,
        price: amount,
        cronInterval,
        memberShare,
        pricePeriodId: pricePeriod.id,
        PricePeriod: pricePeriod,
    }
}

const cabin: CabinProductExtended = {
    id: 1,
    name: 'Hytta',
    type: 'CABIN',
    amount: 1,
    CabinProductPrice: [
        price(spring, SUNDAY_TO_THURSDAY, 1000_00),
        price(spring, FRIDAY_AND_SATURDAY, 1500_00),
        price(summer, SUNDAY_TO_THURSDAY, 1200_00),
        price(summer, FRIDAY_AND_SATURDAY, 1800_00),
    ],
}

const bed: CabinProductExtended = {
    id: 2,
    name: 'Seng',
    type: 'BED',
    amount: 10,
    CabinProductPrice: [
        price(spring, '* * *', 200_00),
        // Members pay less, but only when at least half the party are members.
        price(spring, '* * *', 100_00, 50),
    ],
}

function priceOf({
    products = [cabin],
    productAmounts = [1],
    start,
    end,
    numberOfMembers = 1,
    numberOfNonMembers = 0,
}: {
    products?: CabinProductExtended[],
    productAmounts?: number[],
    start: string,
    end: string,
    numberOfMembers?: number,
    numberOfNonMembers?: number,
}) {
    return calculateCabinBookingPrice({
        pricePeriods,
        products,
        productAmounts,
        startDate: date(start),
        endDate: date(end),
        numberOfMembers,
        numberOfNonMembers,
    })
}

describe('cabin booking price', () => {
    test('weekday and weekend nights are priced by their own price', () => {
        // Thursday to Sunday: a Thursday, a Friday and a Saturday night.
        const rows = priceOf({ start: '2026-03-05', end: '2026-03-08' })

        expect(rows.map(row => [row.productPrice.price, row.amount])).toEqual(
            expect.arrayContaining([[1000_00, 1], [1500_00, 2]])
        )
        expect(calculateTotalCabinBookingPrice(rows)).toBe(1000_00 + 2 * 1500_00)
    })

    test('each night is priced by the price period it falls in', () => {
        // Saturday 30 May and Sunday 31 May are in spring, Monday 1 June is in summer.
        const rows = priceOf({ start: '2026-05-30', end: '2026-06-02' })

        expect(calculateTotalCabinBookingPrice(rows)).toBe(1500_00 + 1000_00 + 1200_00)
    })

    test('the member price applies only when enough of the party are members', () => {
        const nights = { products: [bed], start: '2026-03-02', end: '2026-03-04' }

        const halfMembers = priceOf({ ...nights, numberOfMembers: 1, numberOfNonMembers: 1 })
        const thirdMembers = priceOf({ ...nights, numberOfMembers: 1, numberOfNonMembers: 2 })

        expect(calculateTotalCabinBookingPrice(halfMembers)).toBe(2 * 100_00)
        expect(calculateTotalCabinBookingPrice(thirdMembers)).toBe(2 * 200_00)
    })

    test('the quantity of a product is charged for every night', () => {
        const rows = priceOf({
            products: [bed],
            productAmounts: [3],
            start: '2026-03-02',
            end: '2026-03-05',
            numberOfMembers: 0,
            numberOfNonMembers: 3,
        })

        expect(calculateTotalCabinBookingPrice(rows)).toBe(3 * 3 * 200_00)
    })

    test('a product booked zero times is left out', () => {
        const rows = priceOf({
            products: [cabin, bed],
            productAmounts: [1, 0],
            start: '2026-03-02',
            end: '2026-03-03',
        })

        expect(rows.map(row => row.product.id)).toEqual([cabin.id])
    })

    test('refuses a stay that does not end after it starts', () => {
        expect(() => priceOf({ start: '2026-03-05', end: '2026-03-05' })).toThrow()
        expect(() => priceOf({ start: '2026-03-06', end: '2026-03-05' })).toThrow()
    })

    test('refuses more of a product than there is, or less than none', () => {
        expect(() => priceOf({ productAmounts: [2], start: '2026-03-02', end: '2026-03-03' })).toThrow()
        expect(() => priceOf({ productAmounts: [-1], start: '2026-03-02', end: '2026-03-03' })).toThrow()
    })

    test('refuses a negative number of guests', () => {
        expect(() => priceOf({ numberOfMembers: -1, start: '2026-03-02', end: '2026-03-03' })).toThrow()
        expect(() => priceOf({ numberOfNonMembers: -1, start: '2026-03-02', end: '2026-03-03' })).toThrow()
    })

    test('refuses a night no price period covers', () => {
        expect(() => priceOf({ start: '2025-12-30', end: '2026-01-02' })).toThrow()
    })

    test('refuses a night the product has no price for', () => {
        // The bed has no summer prices.
        expect(() => priceOf({ products: [bed], start: '2026-06-02', end: '2026-06-03' })).toThrow()
    })
})
