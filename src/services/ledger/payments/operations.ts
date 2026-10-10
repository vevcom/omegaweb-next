import '@pn-server-only'
import { paymentAuth } from './auth'
import { stripe } from '@/lib/stripe'
import { ServiceError } from '@/services/error'
import { defineOperation } from '@/services/serviceOperation'
import { PaymentProvider } from '@/prisma-generated-pn-types'
import { stripeCustomerOperations } from '@/services/stripeCustomers/operations'
import logger from '@/lib/logger'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client'
import { z } from 'zod'

export const paymentOperations = {
    /**
     * Creates a new payment record in the db.
     * Important: This method does not call external APIs to enable it to be used in transactions.
     * Call `initiate` to actually begin collecting the payment.
     */
    create: defineOperation({
        authorizer: ({ params }) => paymentAuth.create({ provider: params.provider }),
        paramsSchema: z.object({
            funds: z.number(),
            descriptionLong: z.string().optional(),
            descriptionShort: z.string().optional(),
            provider: z.nativeEnum(PaymentProvider),
            manualFees: z.number().optional(),
            bankAccountNumber: z.string().optional(),
        }),
        operation: async ({ prisma, params }) => prisma.payment.create({
            data: {
                provider: params.provider,
                funds: params.funds,

                ...(params.provider === 'STRIPE' && {
                    state: 'PENDING',
                    stripePayment: {
                        create: {},
                    }
                }),

                // Manual payments are special in that they automatically succeed
                // and fees are determined manually by the user.
                ...(params.provider === 'MANUAL' && {
                    state: 'SUCCEEDED',
                    fees: params.manualFees,
                    manualPayment: {
                        create: {
                            bankAccountNumber: params.bankAccountNumber,
                        },
                    },
                })
            },
            include: {
                stripePayment: true,
                manualPayment: true,
            }
        }),
    }),

    /**
     * Calls the external API to begin collecting the payment.
     *
     * @warning Do not call this method for manual payments! It will fail.
     */
    initiate: defineOperation({
        authorizer: () => paymentAuth.initiate,
        paramsSchema: z.object({
            paymentId: z.number(),
        }),
        // This method does not actually open a transaction. However, it cannot be used
        // inside a transaction as it does external API calls which cannot be reversed.
        opensTransaction: true,
        operation: async ({ prisma, params, session }) => {
            const payment = await prisma.payment.findUniqueOrThrow({
                where: {
                    id: params.paymentId,
                },
                select: {
                    funds: true,
                    provider: true,
                    state: true,
                    descriptionLong: true,
                    descriptionShort: true,
                },
            })

            if (payment.state !== 'PENDING') {
                throw new ServiceError('BAD PARAMETERS', 'Betalingen har allerede blitt forespurt.')
            }

            if (payment.provider === 'MANUAL') {
                throw new ServiceError('BAD PARAMETERS', 'Manuelle betalinger trenger ikke å startes.')
            }

            if (payment.provider === 'STRIPE') {
                // Get timestamp of when the payment was created so that it
                // can be used as part of the idempotency key.
                const createdAt = (await prisma.payment.findUniqueOrThrow({
                    where: {
                        id: params.paymentId,
                    },
                    select: {
                        createdAt: true,
                    },
                })).createdAt.getTime()

                const customerId = session.user
                    ? (await stripeCustomerOperations.readOrCreate({
                        params: { userId: session.user.id },
                    })).customerId
                    : undefined

                const paymentIntent = await stripe.paymentIntents.create({
                    amount: payment.funds,
                    currency: 'nok',
                    description: payment.descriptionLong ?? undefined,
                    statement_descriptor_suffix: payment.descriptionShort ?? undefined,
                    customer: customerId,
                    // Stripe allows us to attach arbitrary metadata to payment intents
                    // Currently, we don't use this for anything, but it might be
                    // useful in the future.
                    metadata: {
                        projectNextPaymentId: params.paymentId,
                    },
                }, {
                    // The idempotency key makes it so that multiple requests with the
                    // same key return the same result. This is useful in case
                    // initiate payment is accidentally called twice.
                    idempotencyKey: `project-next-payment-id-${params.paymentId}-created-at-${createdAt}`,
                })

                if (paymentIntent.client_secret === null) {
                    throw new ServiceError('UNKNOWN ERROR', 'Noe gikk galt med forespørselen til Stripe.')
                }

                // A cancel may have got in between the read above and this write. Writing only
                // while still PENDING keeps a canceled payment canceled, and the intent made for
                // it is canceled too, so it cannot be paid for something already given up.
                try {
                    return await prisma.payment.update({
                        where: {
                            id: params.paymentId,
                            state: 'PENDING',
                        },
                        data: {
                            stripePayment: {
                                update: {
                                    paymentIntentId: paymentIntent.id,
                                    clientSecret: paymentIntent.client_secret,
                                },
                            },
                            state: 'PROCESSING',
                        },
                        include: {
                            stripePayment: true,
                            manualPayment: true,
                        }
                    })
                } catch (error) {
                    if (!(error instanceof PrismaClientKnownRequestError) || error.code !== 'P2025') throw error
                    await stripe.paymentIntents.cancel(
                        paymentIntent.id,
                        {},
                        { idempotencyKey: `project-next-payment-intent-${paymentIntent.id}-cancel-unstarted` },
                    )
                    throw new ServiceError('BAD PARAMETERS', 'Betalingen ble avbrutt før den kom i gang.')
                }
            }

            // If we reach here, the payment provider is unknown.
            throw new ServiceError('SERVER ERROR', 'Prøvde å forespørre betalingsleverandør som ikke er støttet.')
        },
    }),

    /**
     * Cancels a payment that is still awaiting completion (e.g. an abandoned Stripe checkout).
     * If it's a STRIPE payment with a live payment intent, cancels that too, so a webhook that
     * arrives late can never later mark it SUCCEEDED. A no-op if the payment already reached a
     * terminal state (SUCCEEDED/FAILED/CANCELED) by the time this runs. Fails, leaving the
     * payment as it was, if the intent could not be canceled: the money could still be taken for
     * something the caller is about to give up.
     */
    cancel: defineOperation({
        authorizer: () => paymentAuth.cancel,
        paramsSchema: z.object({
            paymentId: z.number(),
        }),
        operation: async ({ prisma, params }) => {
            const payment = await prisma.payment.findUniqueOrThrow({
                where: { id: params.paymentId },
                include: { stripePayment: true },
            })

            if (payment.provider === 'STRIPE' && payment.stripePayment?.paymentIntentId) {
                const paymentIntentId = payment.stripePayment.paymentIntentId
                try {
                    await stripe.paymentIntents.cancel(
                        paymentIntentId,
                        {},
                        { idempotencyKey: `project-next-payment-id-${params.paymentId}-cancel` },
                    )
                } catch (error) {
                    // Stripe refuses to cancel an intent that is already final. That is fine when
                    // it is canceled. A succeeded one is about to be reported by the webhook, and
                    // one still open could be paid later, so neither may be written off here.
                    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId).catch(() => null)
                    if (paymentIntent?.status === 'succeeded') {
                        throw new ServiceError('BAD PARAMETERS', 'Betalingen er allerede gjennomført.')
                    }
                    if (paymentIntent?.status !== 'canceled') {
                        logger.error(`Could not cancel Stripe payment intent for payment ${params.paymentId}`, { error })
                        throw new ServiceError('SERVER ERROR', 'Betalingen kunne ikke avbrytes hos Stripe. Prøv igjen.')
                    }
                }
            }

            await prisma.payment.updateMany({
                where: {
                    id: params.paymentId,
                    state: { in: ['PENDING', 'PROCESSING'] },
                },
                data: { state: 'CANCELED' },
            })

            return await prisma.payment.findUniqueOrThrow({
                where: { id: params.paymentId },
                include: { stripePayment: true, manualPayment: true },
            })
        },
    }),
} as const
