import '@pn-server-only'
import { calculateCabinBookingPrice, calculateTotalCabinBookingPrice } from './cabinPriceCalculator'
import { cabinBookingSchemas } from './schemas'
import { cabinBookingAuth } from './auth'
import {
    cabinBookingFilterSelection,
    cabinBookingIncluder,
    cabinReservationWindowMs,
    maxCabinBookingNights,
    maxUnpaidReservationsPerBooker,
} from './constants'
import { cabinPricePeriodOperations } from '@/services/cabin/pricePeriod/operations'
import { cabinProductPriceIncluder } from '@/services/cabin/product/constants'
import { defineOperation } from '@/services/serviceOperation'
import { takeAdvisoryLock } from '@/lib/advisoryLocks'
import { Smorekopp, ServiceError } from '@/services/error'
import { cabinReleasePeriodOperations } from '@/services/cabin/releasePeriod/operations'
import { cmsParagraphOperations } from '@/cms/paragraphs/operations'
import { paymentOperations } from '@/services/ledger/payments/operations'
import { ledgerTransactionOperations } from '@/services/ledger/transactions/operations'
import { stalePendingTransactionMs } from '@/services/ledger/transactions/constants'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { resolveAccountOwnership } from '@/services/ledger/accounts/ownership'
import crypto from 'crypto'
import type { z } from 'zod'
import type { BookingFiltered } from './types'
import type { BookingType, Prisma } from '@/prisma-generated-pn-types'
import type { PrismaClient } from '@/prisma-generated-pn-client'
import type { ExpandedPayment } from '@/services/ledger/payments/types'
import type { ExpandedLedgerTransaction } from '@/services/ledger/transactions/types'

const dayMs = 24 * 60 * 60 * 1000

/**
 * What blocks the calendar: a booking that is not canceled and either is paid (its window is
 * cleared) or is still inside the window its payment must start in.
 */
export const blocksCalendar = (): Prisma.BookingWhereInput => ({
    canceled: null,
    OR: [
        { transactionTimeout: null },
        { transactionTimeout: { gt: new Date() } },
    ],
})

type BookingProductParams = z.infer<typeof cabinBookingSchemas.params.createCabinBookingNoUser>['bookingProducts']

type Booker = { userId: number } | {
    guest: { firstname: string, lastname: string, email: string, mobile: string },
}

type Reservation = {
    bookingType: BookingType,
    bookingProducts: BookingProductParams,
    booker: Booker,
    start: Date,
    end: Date,
    tenantNotes?: string,
    numberOfMembers: number,
    numberOfNonMembers: number,
}

const withUser = (
    bookingType: BookingType,
    params: { userId: number, bookingProducts: BookingProductParams },
    data: z.infer<typeof cabinBookingSchemas.data.createCabinBookingUserAttached>,
): Reservation => ({
    bookingType,
    bookingProducts: params.bookingProducts,
    booker: { userId: params.userId },
    start: data.start,
    end: data.end,
    tenantNotes: data.tenantNotes,
    numberOfMembers: data.numberOfMembers,
    numberOfNonMembers: data.numberOfNonMembers,
})

const asGuest = (
    bookingType: BookingType,
    params: { bookingProducts: BookingProductParams },
    data: z.infer<typeof cabinBookingSchemas.data.createCabinBookingNoUser>,
): Reservation => ({
    bookingType,
    bookingProducts: params.bookingProducts,
    booker: { guest: { firstname: data.firstname, lastname: data.lastname, email: data.email, mobile: data.mobile } },
    start: data.start,
    end: data.end,
    tenantNotes: data.tenantNotes,
    numberOfMembers: 0,
    numberOfNonMembers: 0,
})

/** The products of a booking in the order asked for, checked against its type and the stock. */
async function readBookingProducts(
    tx: Prisma.TransactionClient,
    bookingType: BookingType,
    bookingProducts: BookingProductParams,
) {
    if (bookingType === 'EVENT' && bookingProducts.length !== 0) {
        throw new ServiceError('BAD PARAMETERS', 'Arrangementbookinger kan ikke inneholde produkter.')
    }
    if (bookingType === 'CABIN' && (bookingProducts.length !== 1 || bookingProducts[0].quantity !== 1)) {
        throw new ServiceError('BAD PARAMETERS', 'Hyttebookinger kan bare inneholde ett produkt med mengde 1.')
    }
    if (bookingType === 'BED' && bookingProducts.length === 0) {
        throw new ServiceError('BAD PARAMETERS', 'Sengebookinger må inneholde minst ett produkt.')
    }

    const products = await tx.cabinProduct.findMany({
        where: { id: { in: bookingProducts.map(product => product.cabinProductId) } },
        include: cabinProductPriceIncluder,
    })
    if (products.length !== bookingProducts.length) {
        throw new ServiceError('BAD PARAMETERS', 'Kunne ikke finne alle hytta produktene. Duplikater er ikke tillat.')
    }

    return bookingProducts.map(({ cabinProductId, quantity }) => {
        const product = products.find(candidate => candidate.id === cabinProductId)
        if (!product) throw new ServiceError('UNKNOWN ERROR', 'Kunne ikke finne mengden av produktet.')
        if (product.type !== bookingType) {
            throw new ServiceError('BAD PARAMETERS', 'Alle produktene må ha samme type som bookingen.')
        }
        if (product.amount < quantity) {
            throw new ServiceError('BAD PARAMETERS', 'Det er ikke nok av produktet til å oppfylle bookingen.')
        }
        return { product, quantity }
    })
}

/**
 * The account every booking is paid into: the one marked CABIN, chosen through connectToLedger
 * below. Until one is, bookings can neither be reserved nor paid for.
 */
async function readDestinationLedgerAccountId(prisma: Prisma.TransactionClient) {
    const account = await prisma.ledgerAccount.findUnique({ where: { special: 'CABIN' }, select: { id: true } })
    if (!account) {
        throw new ServiceError('SERVER ERROR', 'Hyttebooking har ingen tilknyttet konto konfigurert.')
    }
    return account.id
}

/**
 * Reserves the cabin: the booking is created unpaid and holds its dates for the payment window
 * (cabinReservationWindowMs). Every reservation queues behind one lock for its transaction, so
 * the availability check and the insert of one never interleave with another's - two bookers
 * cannot both find the same dates free.
 */
async function reserve(prisma: PrismaClient, { bookingType, bookingProducts, booker, ...booking }: Reservation) {
    return prisma.$transaction(async (tx) => {
        await takeAdvisoryLock(tx, 'cabinBooking')

        const releasePeriod = await cabinReleasePeriodOperations.getCurrentReleasePeriod({
            bypassAuth: true,
            prisma: tx,
        })
        if (releasePeriod === null) {
            throw new ServiceError('SERVER ERROR', 'Hyttebooking siden er ikke tilgjengelig.')
        }
        // Checked before the dates are held, not first at payment: a reservation that could never
        // be paid for would only block the calendar until it expired.
        await readDestinationLedgerAccountId(tx)
        if (booking.end > releasePeriod.releaseUntil) {
            throw new ServiceError('BAD PARAMETERS', 'Hytta kan ikke bookes etter siste slippdato.')
        }
        if (booking.end.getTime() - booking.start.getTime() > maxCabinBookingNights * dayMs) {
            throw new ServiceError('BAD PARAMETERS', `Hytta kan bookes for maks ${maxCabinBookingNights} netter om gangen.`)
        }

        const overlapping = await tx.booking.count({
            where: { start: { lt: booking.end }, end: { gt: booking.start }, ...blocksCalendar() },
        })
        if (overlapping > 0) {
            throw new ServiceError('BAD PARAMETERS', 'Hytta er ikke tilgjengelig i den perioden.')
        }

        const unpaidHolds = await tx.booking.count({
            where: {
                canceled: null,
                transactionTimeout: { gt: new Date() },
                ...('userId' in booker ? { userId: booker.userId } : { guestUser: { email: booker.guest.email } }),
            },
        })
        if (unpaidHolds >= maxUnpaidReservationsPerBooker) {
            throw new ServiceError(
                'BAD PARAMETERS',
                'Du har allerede reservasjoner som venter på betaling. Betal eller frigi dem før du reserverer flere.'
            )
        }

        const products = await readBookingProducts(tx, bookingType, bookingProducts)
        const pricePeriods = await cabinPricePeriodOperations.readMany({ bypassAuth: true, prisma: tx })
        const totalPrice = calculateTotalCabinBookingPrice(calculateCabinBookingPrice({
            pricePeriods,
            products: products.map(({ product }) => product),
            productAmounts: products.map(({ quantity }) => quantity),
            startDate: booking.start,
            endDate: booking.end,
            numberOfMembers: booking.numberOfMembers,
            numberOfNonMembers: booking.numberOfNonMembers,
        }))

        return tx.booking.create({
            data: {
                type: bookingType,
                ...booking,
                totalPrice,
                secret: crypto.randomBytes(24).toString('hex'),
                // The reservation must be paid within this window, or it stops blocking the
                // calendar for others. Cleared once payment succeeds.
                transactionTimeout: new Date(Date.now() + cabinReservationWindowMs),
                BookingProduct: { create: bookingProducts },
                ...('userId' in booker
                    ? { user: { connect: { id: booker.userId } } }
                    : { guestUser: { create: booker.guest } }),
            },
            select: { id: true, secret: true, totalPrice: true, transactionTimeout: true },
        })
    })
}

export const cabinBookingOperations = {
    createCabinBookingUserAttached: defineOperation({
        paramsSchema: cabinBookingSchemas.params.createCabinBookingUserAttached,
        authorizer: ({ params }) => cabinBookingAuth.createCabinBookingUserAttached.data({ userId: params.userId }),
        dataSchema: cabinBookingSchemas.data.createCabinBookingUserAttached,
        opensTransaction: true,
        operation: ({ prisma, params, data }) => reserve(prisma, withUser('CABIN', params, data)),
    }),

    createBedBookingUserAttached: defineOperation({
        paramsSchema: cabinBookingSchemas.params.createBedBookingUserAttached,
        authorizer: ({ params }) => cabinBookingAuth.createBedBookingUserAttached.data({ userId: params.userId }),
        dataSchema: cabinBookingSchemas.data.createBedBookingUserAttached,
        opensTransaction: true,
        operation: ({ prisma, params, data }) => reserve(prisma, withUser('BED', params, data)),
    }),

    createCabinBookingNoUser: defineOperation({
        paramsSchema: cabinBookingSchemas.params.createCabinBookingNoUser,
        authorizer: () => cabinBookingAuth.createCabinBookingNoUser,
        dataSchema: cabinBookingSchemas.data.createCabinBookingNoUser,
        opensTransaction: true,
        operation: ({ prisma, params, data }) => reserve(prisma, asGuest('CABIN', params, data)),
    }),

    createBedBookingNoUser: defineOperation({
        paramsSchema: cabinBookingSchemas.params.createBedBookingNoUser,
        authorizer: () => cabinBookingAuth.createBedBookingNoUser,
        dataSchema: cabinBookingSchemas.data.createBedBookingNoUser,
        opensTransaction: true,
        operation: ({ prisma, params, data }) => reserve(prisma, asGuest('BED', params, data)),
    }),

    readAvailability: defineOperation({
        authorizer: () => cabinBookingAuth.readAvailability,
        operation: async ({ prisma }) => {
            const bookings = await prisma.booking.findMany({
                select: cabinBookingFilterSelection,
                orderBy: { start: 'asc' },
                where: { end: { gte: new Date() }, ...blocksCalendar() },
            })

            // Bookings that follow each other directly are shown as one span, so the calendar
            // gives away that the cabin is taken but not where one booking ends and the next begins.
            return bookings.reduce<BookingFiltered[]>((spans, booking) => {
                const last = spans[spans.length - 1]
                return last && last.end.getTime() === booking.start.getTime()
                    ? [...spans.slice(0, -1), { ...last, end: booking.end }]
                    : [...spans, booking]
            }, [])
        }
    }),

    readMany: defineOperation({
        authorizer: () => cabinBookingAuth.readMany,
        operation: ({ prisma }) => prisma.booking.findMany({
            orderBy: {
                start: 'asc',
            },
            include: cabinBookingIncluder,
        }), // TODO: Pager
    }),

    read: defineOperation({
        authorizer: () => cabinBookingAuth.read,
        paramsSchema: cabinBookingSchemas.params.read,
        operation: ({ prisma, params }) => prisma.booking.findUniqueOrThrow({
            where: params,
            include: cabinBookingIncluder,
        })
    }),

    /** The account cabin bookings are paid into, or null while none is linked. */
    readLedgerAccount: defineOperation({
        authorizer: () => cabinBookingAuth.readLedgerAccount,
        operation: ({ prisma }) => prisma.ledgerAccount.findUnique({
            where: { special: 'CABIN' },
            select: { id: true, name: true },
        }),
    }),

    /**
     * Makes a GROUP ledger account the one cabin bookings are paid into, taking the role from the
     * account that had it. The role is the CABIN marker on LedgerAccount; this is the only place
     * it is given.
     * @param data.ledgerAccountId - The account to credit
     */
    connectToLedger: defineOperation({
        authorizer: async ({ data, prisma }) => cabinBookingAuth.connectToLedger.data({
            accounts: [await resolveAccountOwnership(prisma, { ledgerAccountId: data.ledgerAccountId })],
        }),
        dataSchema: cabinBookingSchemas.data.connectToLedger,
        opensTransaction: true,
        operation: async ({ prisma, data }) => {
            const account = await prisma.ledgerAccount.findUniqueOrThrow({
                where: { id: data.ledgerAccountId },
                select: { type: true },
            })
            if (account.type !== 'GROUP') {
                throw new ServiceError('BAD PARAMETERS', 'Hytta kan bare knyttes til en gruppekonto.')
            }

            return prisma.$transaction(async tx => {
                await tx.ledgerAccount.updateMany({ where: { special: 'CABIN' }, data: { special: null } })
                return tx.ledgerAccount.update({
                    where: { id: data.ledgerAccountId },
                    data: { special: 'CABIN' },
                    select: { id: true, name: true },
                })
            })
        },
    }),

    readSpecialCmsParagraphCabinContract: cmsParagraphOperations.readSpecial.implement({
        authorizer: () => cabinBookingAuth.readSpecialCmsParagraphCabinContract,
        ownershipCheck: ({ params }) => params.special === 'CABIN_CONTRACT'
    }),

    updateSpecialCmsParagraphContentCabinContract: cmsParagraphOperations.updateContent.implement({
        authorizer: () => cabinBookingAuth.updateSpecialCmsParagraphContentCabinContract,
        ownershipCheck: async ({ params }) =>
            await cmsParagraphOperations.isSpecial.internalCall({
                params: {
                    paragraphId: params.paragraphId,
                    special: ['CABIN_CONTRACT']
                },
            })
    }),

    /**
     * Pays for a booking reserved separately via createCabinBooking* and createBedBooking* above.
     * Never creates a booking itself. `secret` authorizes guest (no-session) bookings. Supports
     * paying part of the price from the payer's own ledger balance (`amountFromBalance`) and the
     * rest (`shortfall`) via `provider`; `provider` is only required when the balance doesn't
     * cover the full price.
     */
    createPayment: defineOperation({
        paramsSchema: cabinBookingSchemas.params.createPayment,
        authorizer: async ({ params, prisma }) => {
            const booking = await prisma.booking.findUnique({
                where: { id: params.bookingId },
                select: { userId: true, secret: true },
            })

            return cabinBookingAuth.createPayment.data({
                booking: booking ?? { userId: null, secret: '' },
                providedSecret: params.secret,
            })
        },
        opensTransaction: true,
        operation: async ({ prisma, params }): Promise<{ payment: ExpandedPayment | null }> => {
            const booking = await prisma.booking.findUniqueOrThrow({
                where: { id: params.bookingId },
                include: { guestUser: true },
            })

            if (booking.canceled !== null) {
                throw new Smorekopp('BAD PARAMETERS', 'Reservasjonen er kansellert.')
            }

            if (booking.transactionTimeout !== null && booking.transactionTimeout < new Date()) {
                throw new Smorekopp('BAD PARAMETERS', 'Reservasjonen er utløpt. Vennligst book på nytt.')
            }

            const existingAttempt = await prisma.ledgerTransaction.findFirst({
                where: {
                    bookingId: booking.id,
                    state: { in: ['PENDING', 'SUCCEEDED'] },
                },
            })
            if (existingAttempt?.state === 'SUCCEEDED') {
                throw new Smorekopp('BAD PARAMETERS', 'Denne reservasjonen er allerede betalt.')
            }
            if (existingAttempt) {
                throw new Smorekopp('BAD PARAMETERS', 'Denne reservasjonen har allerede en betaling under behandling.')
            }

            const destinationLedgerAccountId = await readDestinationLedgerAccountId(prisma)

            const funds = booking.totalPrice
            if (params.amountFromBalance > funds) {
                throw new Smorekopp('BAD PARAMETERS', 'Beløpet fra kontosaldo kan ikke overstige prisen.')
            }
            if (params.amountFromBalance > 0 && booking.userId === null) {
                throw new Smorekopp('BAD PARAMETERS', 'Bare innloggede brukere kan betale med kontosaldo.')
            }
            const shortfall = funds - params.amountFromBalance

            if (shortfall > 0 && !params.provider) {
                throw new Smorekopp('BAD PARAMETERS', 'Betalingsmetode må oppgis.')
            }

            let payment: ExpandedPayment | undefined
            const transaction: ExpandedLedgerTransaction = await prisma.$transaction(async tx => {
                // Extends the reservation window to cover the full lifetime a pending attempt is
                // allowed to stay open for before the ledger sweeper cancels it, so the dates
                // can't be released to another booker while this attempt can still succeed.
                // Matching on the window read above also serializes this attempt against a
                // concurrent release or attempt: whichever of them got to the row first changed
                // it, and the loser matches nothing.
                const { count } = await tx.booking.updateMany({
                    where: {
                        id: booking.id,
                        canceled: null,
                        transactionTimeout: booking.transactionTimeout,
                    },
                    data: { transactionTimeout: new Date(Date.now() + stalePendingTransactionMs) },
                })
                if (count === 0) {
                    throw new Smorekopp(
                        'BAD PARAMETERS',
                        'Reservasjonen ble kansellert eller fikk en annen betaling i mellomtiden.'
                    )
                }

                if (shortfall > 0) {
                    payment = await paymentOperations.create({
                        params: {
                            provider: params.provider!,
                            funds: shortfall,
                            manualFees: params.manualFees,
                            descriptionLong: 'Betaling for hyttebooking',
                            descriptionShort: 'Hytta',
                        },
                        prisma: tx,
                    })
                }

                // Outer authorizer (cabinBookingAuth.createPayment) already covers whether this
                // caller may pay for this booking, which read's own ownership check
                // would otherwise re-reject an admin or a guest booking's owner for.
                const payerAccount = params.amountFromBalance > 0
                    ? await ledgerAccountOperations.read({
                        params: { userId: booking.userId! },
                        bypassAuth: true,
                        prisma: tx,
                    })
                    : undefined

                return await ledgerTransactionOperations.create({
                    params: {
                        purpose: 'CABIN_BOOKING',
                        ledgerEntries: [
                            { ledgerAccountId: destinationLedgerAccountId, funds },
                            ...(payerAccount
                                ? [{ ledgerAccountId: payerAccount.id, funds: -params.amountFromBalance }]
                                : []),
                        ],
                        paymentId: payment?.id,
                        bookingId: booking.id,
                        description: params.provider === 'MANUAL' ? params.description : undefined,
                    },
                    prisma: tx,
                })
            })

            // Clearing the reservation window and sending the confirmation once the transaction
            // actually reaches SUCCEEDED is handled by cabinBookingPaymentCompletionHook (see
            // ledger/transactions/paymentCompletionHooks.ts), dispatched from
            // ledgerTransactionOperations.advance - called synchronously above via .create() for
            // MANUAL/balance-only payments, or later from the Stripe webhook for STRIPE ones.

            // Starts collecting the payment and returns its live clientSecret - initiate cancels
            // the transaction and its hold-window extension along with it if starting the
            // payment fails, so the booking can be paid for again instead of sitting stuck.
            return {
                payment: await ledgerTransactionOperations.initiate({
                    params: { id: transaction.id },
                    bypassAuth: true,
                }),
            }
        },
    }),

    /**
     * Gives up a reservation that was never paid for, so its dates free up right away instead of
     * once its payment window runs out. A payment attempt still under way is canceled with it, so
     * it can never complete for dates that are no longer held. Releasing it again does nothing;
     * releasing while a new payment attempt is being started fails and asks for a retry.
     */
    releaseReservation: defineOperation({
        paramsSchema: cabinBookingSchemas.params.releaseReservation,
        authorizer: async ({ params, prisma }) => {
            const booking = await prisma.booking.findUnique({
                where: { id: params.bookingId },
                select: { userId: true, secret: true },
            })

            return cabinBookingAuth.releaseReservation.data({
                booking: booking ?? { userId: null, secret: '' },
                providedSecret: params.secret,
            })
        },
        operation: async ({ prisma, params }) => {
            const booking = await prisma.booking.findUniqueOrThrow({
                where: { id: params.bookingId },
                select: { canceled: true, transactionTimeout: true },
            })

            if (booking.canceled !== null) return

            const attempt = await prisma.ledgerTransaction.findFirst({
                where: {
                    bookingId: params.bookingId,
                    state: { in: ['PENDING', 'SUCCEEDED'] },
                },
            })
            if (booking.transactionTimeout === null || attempt?.state === 'SUCCEEDED') {
                throw new Smorekopp('BAD PARAMETERS', 'Denne reservasjonen er allerede betalt.')
            }
            if (attempt) {
                // Bypassed: the authorizer above already established the caller holds this
                // booking, which is the right bar for canceling a payment attempt on it.
                await ledgerTransactionOperations.cancel({
                    params: { id: attempt.id },
                    bypassAuth: true,
                })
            }

            // Matching on the window read above protects a booking that got paid for meanwhile
            // (the window is cleared) or got a new payment attempt (the window is extended) - see
            // createPayment, which matches the same way.
            const { count } = await prisma.booking.updateMany({
                where: {
                    id: params.bookingId,
                    canceled: null,
                    transactionTimeout: booking.transactionTimeout,
                },
                data: { canceled: new Date() },
            })
            if (count === 0) {
                const current = await prisma.booking.findUniqueOrThrow({
                    where: { id: params.bookingId },
                    select: { canceled: true },
                })
                if (current.canceled !== null) return
                throw new Smorekopp(
                    'BAD PARAMETERS',
                    'En betaling for reservasjonen ble startet i mellomtiden. Prøv igjen.'
                )
            }
        },
    }),
} as const
