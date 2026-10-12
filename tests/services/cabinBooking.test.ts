import { Session } from '@/auth/session/Session'
import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { cabinBookingOperations } from '@/services/cabin/booking/operations'
import { maxCabinBookingNights, maxUnpaidReservationsPerBooker } from '@/services/cabin/booking/constants'
import { userPrivateSelection } from '@/services/users/constants'
import { beforeAll, describe, expect, test } from '@jest/globals'
import type { UserFiltered } from '@/services/users/types'

const day = 24 * 60 * 60 * 1000
/** Midnight UTC the given number of days from now - the calendar works in whole dates. */
const date = (daysFromNow: number) => new Date(new Date(Date.now() + daysFromNow * day).toISOString().slice(0, 10))

let user: UserFiltered
let cabinProductId: number

const guestSession = Session.fromJsObject({ memberships: [], permissions: ['CABIN_USE'], user: null })

const reserveAsUser = (start: number, end: number) => cabinBookingOperations.createCabinBookingUserAttached({
    params: { userId: user.id, bookingProducts: [{ cabinProductId, quantity: 1 }] },
    data: { start: date(start), end: date(end), acceptedTerms: true, numberOfMembers: 2, numberOfNonMembers: 0 },
    session: Session.fromJsObject({ memberships: [], permissions: ['CABIN_USE'], user }),
})

const reserveAsGuest = (email: string, start: number, end: number, quantity = 1) =>
    cabinBookingOperations.createCabinBookingNoUser({
        params: { bookingProducts: [{ cabinProductId, quantity }] },
        data: {
            start: date(start),
            end: date(end),
            acceptedTerms: true,
            firstname: 'Gjest',
            lastname: 'Gjestesen',
            email,
            mobile: '12345678',
        },
        session: guestSession,
    })

beforeAll(async () => {
    user = await prisma.user.create({
        data: {
            username: 'cabin-booking-test',
            email: 'cabin-booking-test@omega.ntnu.no',
            bioParagraph: { create: {} },
            ledgerAccount: { create: { type: 'USER' } },
        },
        select: userPrivateSelection,
    })
    cabinProductId = (await prisma.cabinProduct.findFirstOrThrow({ where: { type: 'CABIN' }, select: { id: true } })).id
})

describe('reserving the cabin', () => {
    test('two bookers of the same nights cannot both reserve them', async () => {
        const outcomes = await Promise.allSettled([reserveAsUser(2, 4), reserveAsGuest('race@example.com', 2, 4)])
        const fulfilled = outcomes.filter(outcome => outcome.status === 'fulfilled')
        const rejected = outcomes.filter(outcome => outcome.status === 'rejected')
        expect(fulfilled).toHaveLength(1)
        expect(rejected).toHaveLength(1)
        expect(rejected[0].status === 'rejected' && rejected[0].reason).toBeInstanceOf(Smorekopp)
    })

    test('the availability shows bookings that follow each other as one span', async () => {
        await reserveAsGuest('first@example.com', 6, 8)
        await reserveAsGuest('second@example.com', 8, 10)

        const spans = await cabinBookingOperations.readAvailability({ session: guestSession })
        expect(spans.some(span => span.start.getTime() === date(6).getTime() && span.end.getTime() === date(10).getTime()))
            .toBe(true)
        expect(spans.some(span => span.start.getTime() === date(8).getTime())).toBe(false)
    })

    test('a booker may only hold so many reservations unpaid', async () => {
        const email = 'hoarder@example.com'
        await Promise.all(Array.from({ length: maxUnpaidReservationsPerBooker }).map((_, index) =>
            reserveAsGuest(email, 12 + 2 * index, 13 + 2 * index)
        ))
        await expect(reserveAsGuest(email, 30, 31)).rejects.toThrow(Smorekopp)
    })

    test('a stay is capped, and a cabin booking is exactly one cabin', async () => {
        await expect(reserveAsGuest('long@example.com', 32, 33 + maxCabinBookingNights)).rejects.toThrow(Smorekopp)
        await expect(reserveAsGuest('double@example.com', 34, 35, 2)).rejects.toThrow(Smorekopp)
    })
})
