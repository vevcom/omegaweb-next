import '@pn-server-only'
import { stripeCustomerAuth } from './auth'
import { ServiceError } from '@/services/error'
import { defineOperation } from '@/services/serviceOperation'
import { stripe } from '@/lib/stripe'
import { z } from 'zod'

export const stripeCustomerOperations = {
    /**
     * If a user already has a Stripe customer associated it is returned.
     * Otherwise, a new customer is created, associated in the DB, and returned.
     */
    readOrCreate: defineOperation({
        authorizer: ({ params: { userId } }) => stripeCustomerAuth.readOrCreate.data({ userId }),
        paramsSchema: z.object({
            userId: z.number(),
        }),
        operation: async ({ params: { userId }, prisma }) => {
            // We query the user table and not the StripeCustomer table here
            // because we also need to fetch the user's email and name in
            // case the Stripe customer does not exist and we need to create it.
            const { stripeCustomer, ...user } = await prisma.user.findUniqueOrThrow({
                where: {
                    id: userId,
                },
                select: {
                    stripeCustomer: {
                        select: {
                            customerId: true,
                        },
                    },
                    email: true,
                    firstname: true,
                    lastname: true,
                }
            })

            // Stripe customers have only a single name field.
            const name = `${user.firstname} ${user.lastname}`

            // If the user doesn't already have a Stripe customer, we need to create one.
            if (!stripeCustomer) {
                // The information we store in the customer is only for out convienience
                // when looking at the Stripe dashboard. This information is never actually
                // used in the code.
                const customer = await stripe.customers.create({
                    email: user.email,
                    name,
                    metadata: {
                        userId: userId.toString(),
                    },
                })

                // We use upsert here since two simultaneous requests could try to
                // create the customer record in our database at the same time.
                // (This has actually happened during testing.)
                return await prisma.stripeCustomer.upsert({
                    where: {
                        userId,
                    },
                    create: {
                        userId,
                        customerId: customer.id,
                    },
                    update: {
                        // Don't update anything. Let the first created account win.
                    },
                    select: {
                        customerId: true,
                    },
                })
            }

            // Otherwise, we can just return the existing customer.
            // But, we'll first verify that it is not deleted and that
            // the stored information are up to date.

            const customer = await stripe.customers.retrieve(stripeCustomer.customerId)

            if (customer.deleted) {
                // This should never happen as we never delete customers in Stripe.
                throw new ServiceError(
                    'SERVER ERROR',
                    'Stripe kunden tilknyttet brukeren er slettet. Vennligst kontakt Vevcom.',
                )
            }

            if (customer.email !== user.email || customer.name !== `${user.firstname} ${user.lastname}`) {
                await stripe.customers.update(stripeCustomer.customerId, {
                    email: user.email,
                    name,
                    metadata: {
                        userId: userId.toString(),
                    },
                })
            }

            return {
                customerId: stripeCustomer.customerId,
            }
        }
    }),

    /**
     * Creates a Stripe customer session which allows the frontend to manage the saved payment methods
     * for the user. This session is a one time use object and needs to be created each time it is needed.
     *
     * If the user does not have a Stripe customer associated it will be created automatically.
     */
    createSession: defineOperation({
        authorizer: ({ params: { userId } }) => stripeCustomerAuth.createSession.data({ userId }),
        paramsSchema: z.object({
            userId: z.number(),
        }),
        operation: async ({ params: { userId } }) => {
            const { customerId } = await stripeCustomerOperations.readOrCreate({ params: { userId } })

            // I havent seen much about this customer session API on the internet.
            // I guess it must be rather new? Here is a link to the docs in case you wonder how it works:
            // https://docs.stripe.com/payments/accept-a-payment-deferred?platform=web&type=payment#save-payment-methods
            // https://docs.stripe.com/api/customer_sessions/create
            const customerSession = await stripe.customerSessions.create({
                components: {
                    payment_element: {
                        enabled: true,
                        features: {
                            // Show all payment methods, even those that are "limited" or "unspecified" in display.
                            payment_method_allow_redisplay_filters: ['always', 'limited', 'unspecified'],
                            // Enable avaialble payment methods to be shown for the user.
                            payment_method_redisplay: 'enabled',
                            // Max allowed by Stripe, not that anyone will ever reach this lol.
                            payment_method_redisplay_limit: 10,
                            // Allow removal of payment methods.
                            payment_method_remove: 'enabled',
                            // Allow new payment methods to be added.
                            payment_method_save: 'enabled',
                            // Specify that new payment methods will be used manually by the user.
                            // (As opposed to automatically by the server, for example a subscription.)
                            payment_method_save_usage: 'on_session',
                        }
                    }
                },
                customer: customerId,
            })

            // The customer session is a one time use object, so we don't need to (nor should we) store it in the DB.

            // Only return what is needed by the frontend.
            return {
                customerSessionClientSecret: customerSession.client_secret,
            }
        }
    }),

    /**
     * Creates a setup intent for adding a new payment method to the user's customer account in Stripe.
     */
    createSetupIntent: defineOperation({
        authorizer: ({ params: { userId } }) => stripeCustomerAuth.createSetupIntent.data({ userId }),
        paramsSchema: z.object({
            userId: z.number(),
        }),
        operation: async ({ params: { userId } }) => {
            const customerId: string = (await stripeCustomerOperations.readOrCreate({ params: { userId } })).customerId

            const setupIntent = await stripe.setupIntents.create({ customer: customerId })

            if (!setupIntent.client_secret) {
                throw new ServiceError(
                    'UNKNOWN ERROR',
                    'Noe gikk galt ved opprettelse av betalingsmetode.',
                )
            }

            return {
                setupIntentClientSecret: setupIntent.client_secret,
            }
        }
    }),

    /**
     * Returns a filtered list of saved payment methods for the user.
     */
    readSavedPaymentMethods: defineOperation({
        authorizer: ({ params: { userId } }) => stripeCustomerAuth.readSavedPaymentMethods.data({ userId }),
        paramsSchema: z.object({
            userId: z.number(),
        }),
        operation: async ({ params: { userId }, session }) => {
            // readOrCreate is strictly self-service, but this operation's own authorizer above
            // already allows LEDGER_ADMIN, so bypass it here rather than blocking admins.
            const customerId: string = (await stripeCustomerOperations.readOrCreate({
                session,
                bypassAuth: true,
                params: { userId },
            })).customerId

            const paymentMethods = await stripe.paymentMethods.list({
                customer: customerId,
            })

            // Filter out only the necessary information to return to the frontend.
            // This is to avoid leaking any sensitive information.
            const filteredPaymentMethods = paymentMethods.data.map(paymentMethod => ({
                id: paymentMethod.id,
                type: paymentMethod.type,
                card: paymentMethod.card && {
                    brand: paymentMethod.card.brand,
                    last4: paymentMethod.card.last4,
                    exp_month: paymentMethod.card.exp_month,
                    exp_year: paymentMethod.card.exp_year,
                },
            }))

            return filteredPaymentMethods
        }
    }),

    /**
     * Deletes (or "detaches" in Stripe lingo) a saved payment method from the user's customer account in Stripe.
     */
    deleteSavedPaymentMethod: defineOperation({
        authorizer: ({ params: { userId } }) => stripeCustomerAuth.deleteSavedPaymentMethod.data({ userId }),
        paramsSchema: z.object({
            userId: z.number(),
            paymentMethodId: z.string(),
        }),
        operation: async ({ params: { userId, paymentMethodId }, session }) => {
            // readOrCreate is strictly self-service, but this operation's own authorizer above
            // already allows LEDGER_ADMIN, so bypass it here rather than blocking admins.
            const customerId: string = (await stripeCustomerOperations.readOrCreate({
                session,
                bypassAuth: true,
                params: { userId },
            })).customerId

            // Confirm the payment method actually belongs to this user's Stripe customer before
            // detaching it. The authorizer above only checks the caller's access to `userId`,
            // not that the caller-supplied `paymentMethodId` is actually theirs - without this,
            // any user could detach any other user's payment method by ID.
            await stripe.customers.retrievePaymentMethod(customerId, paymentMethodId)

            await stripe.paymentMethods.detach(paymentMethodId)

            return {
                success: true
            }
        }
    }),
} as const
