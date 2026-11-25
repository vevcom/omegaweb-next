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
let nextUserNumber = 0
let cabinProductId: number

const guestSession = Session.fromJsObject({ memberships: [], permissions: ['CABIN_USE'], user: null })

const createUser = () => {
    const username = `cabin-booking-test-${nextUserNumber++}`
    return prisma.user.create({
        data: {
            username,
            email: `${username}@omega.ntnu.no`,
            bioParagraph: { create: {} },
            ledgerAccount: { create: { type: 'USER' } },
        },
        select: userPrivateSelection,
    })
}

const userSession = (booker: UserFiltered) =>
    Session.fromJsObject({ memberships: [], permissions: ['CABIN_USE'], user: booker })

const reserveAs = (booker: UserFiltered, start: number, end: number, quantity = 1) =>
    cabinBookingOperations.createCabinBookingUserAttached({
        params: { userId: booker.id, bookingProducts: [{ cabinProductId, quantity }] },
        data: { start: date(start), end: date(end), acceptedTerms: true, numberOfMembers: 2, numberOfNonMembers: 0 },
        session: userSession(booker),
    })

const reserveAsUser = (start: number, end: number) => reserveAs(user, start, end)

/** Reserves as a booker of their own, so the cap on unpaid reservations does not get in the way. */
const reserveAsNewUser = async (start: number, end: number, quantity = 1) =>
    reserveAs(await createUser(), start, end, quantity)

beforeAll(async () => {
    user = await createUser()
    cabinProductId = (await prisma.cabinProduct.findFirstOrThrow({ where: { type: 'CABIN' }, select: { id: true } })).id
    // Reserving is refused until the cabin has an account to pay the bookings into.
    await prisma.ledgerAccount.create({ data: { type: 'GROUP', name: 'Hyttekonto', special: 'CABIN' } })
})

describe('reserving the cabin', () => {
    test('two bookers of the same nights cannot both reserve them', async () => {
        const outcomes = await Promise.allSettled([reserveAsUser(2, 4), reserveAsNewUser(2, 4)])
        const fulfilled = outcomes.filter(outcome => outcome.status === 'fulfilled')
        const rejected = outcomes.filter(outcome => outcome.status === 'rejected')
        expect(fulfilled).toHaveLength(1)
        expect(rejected).toHaveLength(1)
        expect(rejected[0].status === 'rejected' && rejected[0].reason).toBeInstanceOf(Smorekopp)
    })

    test('the availability shows bookings that follow each other as one span', async () => {
        await reserveAsNewUser(6, 8)
        await reserveAsNewUser(8, 10)

        const spans = await cabinBookingOperations.readAvailability({ session: guestSession })
        expect(spans.some(span => span.start.getTime() === date(6).getTime() && span.end.getTime() === date(10).getTime()))
            .toBe(true)
        expect(spans.some(span => span.start.getTime() === date(8).getTime())).toBe(false)
    })

    test('a booker may only hold so many reservations unpaid', async () => {
        const hoarder = await createUser()
        await Promise.all(Array.from({ length: maxUnpaidReservationsPerBooker }).map((_, index) =>
            reserveAs(hoarder, 12 + 2 * index, 13 + 2 * index)
        ))
        await expect(reserveAs(hoarder, 30, 31)).rejects.toThrow(Smorekopp)
    })

    test('the number of members and non-members must be whole numbers', async () => {
        await expect(cabinBookingOperations.createCabinBookingUserAttached({
            params: { userId: user.id, bookingProducts: [{ cabinProductId, quantity: 1 }] },
            data: { start: date(36), end: date(37), acceptedTerms: true, numberOfMembers: 0.5, numberOfNonMembers: 1 },
            session: userSession(user),
        })).rejects.toThrow(Smorekopp)
    })

    test('a stay is capped, and a cabin booking is exactly one cabin', async () => {
        await expect(reserveAsNewUser(32, 33 + maxCabinBookingNights)).rejects.toThrow(Smorekopp)
        await expect(reserveAsNewUser(34, 35, 2)).rejects.toThrow(Smorekopp)
    })
})

describe('reserving beds', () => {
    let bed: { id: number, amount: number }

    beforeAll(async () => {
        bed = await prisma.cabinProduct.findFirstOrThrow({ where: { type: 'BED' }, select: { id: true, amount: true } })
    })

    const reserveBeds = async (start: number, end: number, quantity: number) => {
        const booker = await createUser()
        return cabinBookingOperations.createBedBookingUserAttached({
            params: { userId: booker.id, bookingProducts: [{ cabinProductId: bed.id, quantity }] },
            data: { start: date(start), end: date(end), acceptedTerms: true, numberOfMembers: 0, numberOfNonMembers: 0 },
            session: userSession(booker),
        })
    }

    test('bed bookings share the nights until the beds run out', async () => {
        await reserveBeds(36, 38, 1)
        await expect(reserveBeds(37, 39, bed.amount - 1)).resolves.toBeDefined()
        await expect(reserveBeds(37, 38, 1)).rejects.toThrow(Smorekopp)
    })

    test('the whole cabin cannot be booked over booked beds', async () => {
        await expect(reserveAsNewUser(36, 37)).rejects.toThrow(Smorekopp)
    })
})

describe('canceling a paid booking', () => {
    /** A booking whose payment has SUCCEEDED and been confirmed, paid for through Stripe. */
    const guest = { firstname: 'Gjest', lastname: 'Gjestesen', email: 'g@example.com', mobile: '12345678' }

    async function createPaidBooking(start: number, end: number, asGuest = false) {
        const cabinAccount = await prisma.ledgerAccount.findUniqueOrThrow({ where: { special: 'CABIN' } })
        return prisma.booking.create({
            data: {
                type: 'CABIN',
                start: date(start),
                end: date(end),
                numberOfMembers: 2,
                numberOfNonMembers: 0,
                totalPrice: 1000_00,
                secret: `paid-${start}`,
                ...(asGuest
                    ? { guestUser: { create: guest } }
                    : { user: { connect: { id: user.id } } }),
                ledgerTransactions: {
                    create: {
                        purpose: 'CABIN_BOOKING',
                        state: 'SUCCEEDED',
                        ledgerEntries: { create: [{ ledgerAccountId: cabinAccount.id, funds: 1000_00, fees: 0 }] },
                    },
                },
            },
            include: { ledgerTransactions: true },
        })
    }

    test('more than three weeks ahead, the price goes back to the user\'s account', async () => {
        const booking = await createPaidBooking(60, 62)

        await cabinBookingOperations.cancel({ params: { bookingId: booking.id }, session: userSession(user) })

        const userAccount = await prisma.user.findUniqueOrThrow({
            where: { id: user.id },
            select: { ledgerAccountId: true },
        })
        const refund = await prisma.refund.findUniqueOrThrow({
            where: { originalTransactionId: booking.ledgerTransactions[0].id },
            include: { refundTransaction: { include: { ledgerEntries: true } } },
        })
        expect(refund.refundTransaction.ledgerEntries).toEqual(expect.arrayContaining([
            expect.objectContaining({ funds: 1000_00, ledgerAccountId: userAccount.ledgerAccountId }),
        ]))
        const bookings = await cabinBookingOperations.readManyOfUser({
            params: { userId: user.id },
            session: userSession(user),
        })
        expect(bookings.find(listed => listed.id === booking.id)?.canceled).not.toBeNull()
    })

    test('less than three weeks ahead, the booking stays', async () => {
        const booking = await createPaidBooking(19, 20)

        await expect(cabinBookingOperations.cancel({ params: { bookingId: booking.id }, session: userSession(user) }))
            .rejects.toMatchObject({ errors: [{ message: expect.stringContaining('dager før innsjekk') }] })
        await expect(prisma.booking.findUniqueOrThrow({ where: { id: booking.id } }))
            .resolves.toMatchObject({ canceled: null })
    })

    test('no one but the booker can cancel it', async () => {
        const booking = await createPaidBooking(64, 66)

        await expect(cabinBookingOperations.cancel({ params: { bookingId: booking.id }, session: guestSession }))
            .rejects.toThrow(Smorekopp)
    })

    test('the user\'s list leaves out reservations never paid for', async () => {
        const reservation = await reserveAsUser(40, 41)

        const bookings = await cabinBookingOperations.readManyOfUser({
            params: { userId: user.id },
            session: userSession(user),
        })
        expect(bookings.map(listed => listed.id)).not.toContain(reservation.id)
    })

    const adminSession = Session.fromJsObject({ memberships: [], permissions: ['CABIN_ADMIN'], user })
    const cancelAsAdmin = (bookingId: number, refund: boolean, session = adminSession) =>
        cabinBookingOperations.cancelAsAdmin({ params: { bookingId }, data: { refund }, session })

    test('the cabin team can cancel close to check-in, refunding the price', async () => {
        const booking = await createPaidBooking(21, 22)

        await cancelAsAdmin(booking.id, true)

        await expect(prisma.refund.findUnique({ where: { originalTransactionId: booking.ledgerTransactions[0].id } }))
            .resolves.not.toBeNull()
        await expect(prisma.booking.findUniqueOrThrow({ where: { id: booking.id } }))
            .resolves.toMatchObject({ canceled: expect.any(Date) })
    })

    test('the cabin team can cancel without refunding', async () => {
        const booking = await createPaidBooking(23, 24)

        await cancelAsAdmin(booking.id, false)

        await expect(prisma.refund.findUnique({ where: { originalTransactionId: booking.ledgerTransactions[0].id } }))
            .resolves.toBeNull()
    })

    test('a guest refund is left to a manual review', async () => {
        const booking = await createPaidBooking(25, 26, true)

        await cancelAsAdmin(booking.id, true)

        await expect(prisma.manualTransactionReview.findFirst({
            where: { transactionId: booking.ledgerTransactions[0].id, problem: 'CABIN_GUEST_REFUND' },
        })).resolves.not.toBeNull()
    })

    test('only the cabin team cancels as admin', async () => {
        const booking = await createPaidBooking(27, 28)

        await expect(cancelAsAdmin(booking.id, true, userSession(user))).rejects.toThrow(Smorekopp)
    })
})
