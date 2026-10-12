import '@pn-server-only'
import { calculateCabinBookingPrice, calculateTotalCabinBookingPrice } from './cabinPriceCalculator'
import { cabinBookingSchemas } from './schemas'
import { cabinBookingAuth } from './auth'
import { cabinReservationWindowMs, cabinBookingFilterSelection, cabinBookingIncluder } from './constants'
import { cabinPricePeriodOperations } from '@/services/cabin/pricePeriod/operations'
import { cabinProductPriceIncluder } from '@/services/cabin/product/constants'
import { defineOperation, defineSubOperation } from '@/services/serviceOperation'
import { Smorekopp, ServiceError } from '@/services/error'
import { cabinReleasePeriodOperations } from '@/services/cabin/releasePeriod/operations'
import { cmsParagraphOperations } from '@/cms/paragraphs/operations'
import { paymentOperations } from '@/services/ledger/payments/operations'
import { ledgerTransactionOperations } from '@/services/ledger/transactions/operations'
import { stalePendingTransactionMs } from '@/services/ledger/transactions/constants'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { BookingType, PaymentProvider } from '@/prisma-generated-pn-types'
import logger from '@/lib/logger'
import { z } from 'zod'
import crypto from 'crypto'
import type { CabinProductExtended } from '@/services/cabin/product/constants'
import type { ExpandedPayment } from '@/services/ledger/payments/types'
import type { ExpandedLedgerTransaction } from '@/services/ledger/transactions/types'

const cabinAvailable = defineSubOperation({
    paramsSchema: () => z.object({
        start: z.date(),
        end: z.date()
    }),
    operation: () => async ({ prisma, params }) => {
        const results = await prisma.booking.findMany({
            where: {
                start: {
                    lt: params.end,
                },
                end: {
                    gt: params.start,
                },
                canceled: null,
                // An unpaid reservation stops blocking the calendar once its payment window
                // (transactionTimeout) has passed. Confirmed bookings have it cleared to null.
                OR: [
                    { transactionTimeout: null },
                    { transactionTimeout: { gt: new Date() } },
                ],
            }
        })
        return results.length === 0
    }
})

const bookingProductParams = z.array(z.object({
    cabinProductId: z.number(),
    quantity: z.number().int().min(1),
}))


const create = defineSubOperation({
    paramsSchema: () => z.object({
        bookingType: z.nativeEnum(BookingType),
        bookingProducts: bookingProductParams,
    }),
    dataSchema: () => cabinBookingSchemas.createBookingUserAttached,
    operation: () => async ({ prisma, params, data }) => {
        // TODO: Prevent Race conditions

        const latestReleaseDate = await cabinReleasePeriodOperations.getCurrentReleasePeriod({
            bypassAuth: true,
        })

        if (latestReleaseDate === null) {
            throw new ServiceError('SERVER ERROR', 'Hyttebooking siden er ikke tilgjengelig.')
        }

        if (data.end > latestReleaseDate.releaseUntil) {
            throw new ServiceError('BAD PARAMETERS', 'Hytta kan ikke bookes etter siste slippdato.')
        }

        if (!await cabinAvailable.internalCall({
            params: data,
        })) {
            throw new ServiceError('BAD PARAMETERS', 'Hytta er ikke tilgjengelig i den perioden.')
        }

        const products = await prisma.cabinProduct.findMany({
            where: {
                id: {
                    in: params.bookingProducts.map(product => product.cabinProductId),
                }
            },
            include: cabinProductPriceIncluder,
        })
        if (products.length !== params.bookingProducts.length) {
            throw new ServiceError('BAD PARAMETERS', 'Kunne ikke finne alle hytta produktene. Duplikater er ikke tillat.')
        }

        const productsInOrder: CabinProductExtended[] = []

        for (const paramProduct of params.bookingProducts) {
            const product = products.find(prodItem => prodItem.id === paramProduct.cabinProductId)
            if (!product) {
                throw new ServiceError('UNKNOWN ERROR', 'Kunne ikke finne mengden av produktet.')
            }
            productsInOrder.push(product)

            if (product.type !== params.bookingType) {
                throw new ServiceError('BAD PARAMETERS', 'Alle produktene må ha samme type som bookingen.')
            }

            if (product.amount < paramProduct.quantity) {
                throw new ServiceError('BAD PARAMETERS', 'Det er ikke nok av produktet til å oppfylle bookingen.')
            }
        }

        if (params.bookingType === 'EVENT' && params.bookingProducts.length !== 0) {
            throw new ServiceError('BAD PARAMETERS', 'Arrangementbookinger kan ikke inneholde produkter.')
        }

        if (params.bookingType === 'CABIN' &&
            params.bookingProducts.length !== 1 &&
            params.bookingProducts[0].quantity !== 1
        ) {
            throw new ServiceError('BAD PARAMETERS', 'Hyttebookinger kan bare inneholde ett produkt med mengde 1.')
        }

        if (params.bookingType === 'BED' && params.bookingProducts.length === 0) {
            throw new ServiceError('BAD PARAMETERS', 'Sengebookinger må inneholde minst ett produkt.')
        }

        const pricePeriods = await cabinPricePeriodOperations.readMany({ bypassAuth: true })

        const priceObjects = calculateCabinBookingPrice({
            pricePeriods,
            products: productsInOrder,
            productAmounts: params.bookingProducts.map(prod => prod.quantity),
            startDate: data.start,
            endDate: data.end,
            numberOfMembers: data.numberOfMembers,
            numberOfNonMembers: data.numberOfNonMembers
        })

        const totalPrice = calculateTotalCabinBookingPrice(priceObjects)
        logger.debug(`Total price: ${totalPrice}`)

        return await prisma.booking.create({
            data: {
                type: params.bookingType,
                start: data.start,
                end: data.end,
                tenantNotes: data.tenantNotes,
                numberOfMembers: data.numberOfMembers,
                numberOfNonMembers: data.numberOfNonMembers,
                totalPrice,
                secret: crypto.randomBytes(24).toString('hex'),
                // The reservation must be paid within this window, or it stops blocking the
                // calendar for others (see cabinAvailable). Cleared once payment succeeds.
                transactionTimeout: new Date(Date.now() + cabinReservationWindowMs),
                BookingProduct: {
                    create: params.bookingProducts.map(product => ({
                        cabinProductId: product.cabinProductId,
                        quantity: product.quantity,
                    }))
                }
            }
        })
    }
})

const createBookingWithUser = defineSubOperation({
    paramsSchema: () => z.object({
        userId: z.number(),
        bookingType: z.nativeEnum(BookingType),
        bookingProducts: bookingProductParams,
    }),
    dataSchema: () => cabinBookingSchemas.createBookingUserAttached,
    operation: () => async ({ prisma, params, data }) => {
        const result = await create.internalCall({
            params,
            data,
        })

        await prisma.booking.update({
            where: {
                id: result.id,
            },
            data: {
                user: {
                    connect: {
                        id: params.userId,
                    }
                }
            }
        })

        return {
            id: result.id,
            secret: result.secret,
            totalPrice: result.totalPrice,
            transactionTimeout: result.transactionTimeout,
        }
    }
})

const createBookingNoUser = defineSubOperation({
    paramsSchema: () => z.object({
        bookingType: z.nativeEnum(BookingType),
        bookingProducts: bookingProductParams,
    }),
    dataSchema: () => cabinBookingSchemas.createBookingNoUser,
    operation: () => async ({ prisma, params, data }) => {
        const result = await create.internalCall({
            params,
            data: {
                ...data,
                numberOfMembers: 0,
                numberOfNonMembers: 0,
            },
        })

        await prisma.booking.update({
            where: {
                id: result.id,
            },
            data: {
                guestUser: {
                    create: {
                        firstname: data.firstname,
                        lastname: data.lastname,
                        email: data.email,
                        mobile: data.mobile,
                    }
                }
            }
        })

        return {
            id: result.id,
            secret: result.secret,
            totalPrice: result.totalPrice,
            transactionTimeout: result.transactionTimeout,
        }
    }
})

export const cabinBookingOperations = {
    createCabinBookingUserAttached: defineOperation({
        paramsSchema: z.object({
            userId: z.number(),
            bookingProducts: bookingProductParams,
        }),
        authorizer: ({ params }) => cabinBookingAuth.createCabinBookingUserAttached.data({ userId: params.userId }),
        dataSchema: cabinBookingSchemas.createBookingUserAttached,
        operation: async ({ params, data }) =>
            createBookingWithUser.internalCall({
                params: {
                    userId: params.userId,
                    bookingType: BookingType.CABIN,
                    bookingProducts: params.bookingProducts,
                },
                data,
            })
    }),

    createBedBookingUserAttached: defineOperation({
        paramsSchema: z.object({
            userId: z.number(),
            bookingProducts: bookingProductParams,
        }),
        authorizer: ({ params }) => cabinBookingAuth.createBedBookingUserAttached.data({ userId: params.userId }),
        dataSchema: cabinBookingSchemas.createBookingUserAttached,
        operation: async ({ params, data }) =>
            createBookingWithUser.internalCall({
                params: {
                    userId: params.userId,
                    bookingType: BookingType.BED,
                    bookingProducts: params.bookingProducts,
                },
                data,
            })
    }),

    createCabinBookingNoUser: defineOperation({
        paramsSchema: z.object({
            bookingProducts: bookingProductParams,
        }),
        authorizer: () => cabinBookingAuth.createCabinBookingNoUser,
        dataSchema: cabinBookingSchemas.createBookingNoUser,
        operation: async ({ params, data }) => createBookingNoUser.internalCall({
            params: {
                bookingType: BookingType.CABIN,
                bookingProducts: params.bookingProducts,
            },
            data,
        })
    }),

    createBedBookingNoUser: defineOperation({
        paramsSchema: z.object({
            bookingProducts: bookingProductParams,
        }),
        authorizer: () => cabinBookingAuth.createBedBookingNoUser,
        dataSchema: cabinBookingSchemas.createBookingNoUser,
        operation: async ({ params, data }) => createBookingNoUser.internalCall({
            params: {
                bookingType: BookingType.BED,
                bookingProducts: params.bookingProducts,
            },
            data,
        })
    }),

    readAvailability: defineOperation({
        authorizer: () => cabinBookingAuth.readAvailability,
        operation: async ({ prisma }) => {
            const results = await prisma.booking.findMany({
                select: cabinBookingFilterSelection,
                orderBy: {
                    start: 'asc'
                },
                where: {
                    canceled: null,
                    end: {
                        gte: new Date(),
                    },
                    OR: [
                        { transactionTimeout: null },
                        { transactionTimeout: { gt: new Date() } },
                    ],
                },
            })

            // Anonymize the bookings a bit
            for (let i = results.length - 1; i > 0; i--) {
                if (results[i].start === results[i - 1].end) {
                    results[i - 1].end = results[i].end
                    results.splice(i)
                }
            }

            return results
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
        paramsSchema: z.object({
            id: z.number(),
        }),
        operation: ({ prisma, params }) => prisma.booking.findUniqueOrThrow({
            where: params,
            include: cabinBookingIncluder,
        })
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
        paramsSchema: z.object({
            bookingId: z.number(),
            secret: z.string().min(1),
            provider: z.nativeEnum(PaymentProvider).optional(),
            amountFromBalance: z.coerce.number().nonnegative().default(0),
            manualFees: z.coerce.number().nonnegative().default(0),
            description: z.string().optional(),
        }),
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
                const isStale = Date.now() - existingAttempt.createdAt.getTime() > stalePendingTransactionMs
                if (!isStale) {
                    throw new Smorekopp('BAD PARAMETERS', 'Denne reservasjonen har allerede en betaling under behandling.')
                }
                // Stale (likely abandoned) attempt - cancel it (also cancels any Stripe payment
                // intent, so a late webhook for it can never complete) and let this one proceed.
                // Bypassed: the outer authorizer already established this caller may pay for
                // this booking, which is the right bar for canceling a stale attempt on it.
                await ledgerTransactionOperations.cancel({
                    params: { id: existingAttempt.id },
                    bypassAuth: true,
                })
            }

            const cabinSettings = await prisma.cabinSettings.findFirst()
            if (!cabinSettings?.ledgerAccountId) {
                throw new Smorekopp('SERVER ERROR', 'Hyttebooking har ingen tilknyttet konto konfigurert.')
            }
            const destinationLedgerAccountId = cabinSettings.ledgerAccountId

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

            const transaction: ExpandedLedgerTransaction = await prisma.$transaction(async tx => {
                // Extends the reservation window to cover the full lifetime a pending attempt is
                // allowed to stay open for (see stalePendingTransactionMs above), so cabinAvailable
                // can't release these dates to another booker while this attempt can still succeed.
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

                let paymentId: number | undefined

                if (shortfall > 0) {
                    const payment = await paymentOperations.create({
                        params: {
                            provider: params.provider!,
                            funds: shortfall,
                            manualFees: params.manualFees,
                            descriptionLong: 'Betaling for hyttebooking',
                            descriptionShort: 'Hytta',
                        },
                        prisma: tx,
                    })
                    paymentId = payment.id
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
                        paymentId,
                        bookingId: booking.id,
                        description: params.provider === 'MANUAL' ? params.description : undefined,
                    },
                    prisma: tx,
                })
            })

            let payment = transaction.payment
            if (payment?.state === 'PENDING') {
                payment = await paymentOperations.initiate({
                    params: { paymentId: payment.id },
                })
            }

            // Clearing the reservation window and sending the confirmation once the transaction
            // actually reaches SUCCEEDED is handled by cabinBookingPaymentCompletionHook (see
            // ledger/transactions/paymentCompletionHooks.ts), dispatched from
            // ledgerTransactionOperations.advance - called synchronously above via .create() for
            // MANUAL/balance-only payments, or later from the Stripe webhook for STRIPE ones.

            return { payment }
        },
    }),

    /**
     * Gives up a reservation that was never paid for, so its dates free up right away instead of
     * once its payment window runs out. A payment attempt still under way is canceled with it, so
     * it can never complete for dates that are no longer held. Releasing it again does nothing;
     * releasing while a new payment attempt is being started fails and asks for a retry.
     */
    releaseReservation: defineOperation({
        paramsSchema: z.object({
            bookingId: z.number(),
            secret: z.string().min(1),
        }),
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
