import logger from '@/lib/logger'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/prisma/client'
import { ledgerTransactionOperations } from '@/services/ledger/transactions/operations'
import { refundOperations } from '@/services/ledger/refunds/operations'
import { manualReviewOperations } from '@/services/ledger/transactions/manualReviews/operations'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client'
import Stripe from 'stripe'
import type { PaymentState } from '@/prisma-generated-pn-types'

/**
 * Utility function to retrieve the Stripe fees for a given payment intent.
 */
export async function retrieveStripeFees(paymentIntent: Stripe.PaymentIntent): Promise<number> {
    let totalFees = 0

    // for await pages through all results automatically, so this sums fees across every
    // charge, not just the first page (Stripe defaults to 10 per page).
    for await (const charge of stripe.charges.list({
        payment_intent: paymentIntent.id,
    })) {
        if (!charge.balance_transaction) {
            logger.error(`Charge does not have a balance transaction: ${charge.id}`)
            continue
        }

        const balanceTransaction = typeof charge.balance_transaction === 'string'
            ? await stripe.balanceTransactions.retrieve(charge.balance_transaction)
            : charge.balance_transaction

        totalFees += balanceTransaction.fee
    }

    return totalFees
}

// Map between Stripe event types and our internal payment states.
const EVENT_TYPE_TO_STATE: Partial<Record<Stripe.Event['type'], PaymentState>> = {
    'payment_intent.canceled': 'CANCELED',
    'payment_intent.succeeded': 'SUCCEEDED',
    'payment_intent.payment_failed': 'FAILED',
}

/**
 * Calls `refundOperations.reimburseUnappliedPayment`, flagging the transaction for manual review
 * rather than throwing on failure. Any failure here means Stripe genuinely holds money that
 * nothing will automatically credit back, so it always needs a human regardless of why the call
 * failed - there's no other page or system yet that would otherwise find this on its own.
 * Wrapped in its own transaction so the payment's state update and the correction it posts commit
 * together - without this, a duplicate webhook delivery could hit the Refund row's unique
 * constraint after the payment was already marked SUCCEEDED and the correcting transaction
 * already posted.
 */
async function reimburseOrLogManualAction(
    originalTransactionId: number,
    reason: string,
) {
    try {
        await prisma.$transaction(tx => refundOperations.reimburseUnappliedPayment({
            params: { originalTransactionId, reason },
            prisma: tx,
            bypassAuth: true,
        }))
    } catch (error) {
        await manualReviewOperations.create({
            params: {
                transactionId: originalTransactionId,
                problemDescription: `Automatisk tilbakebetaling mislyktes: ${reason}`,
                error,
            },
            bypassAuth: true,
        })
    }
}

/**
 * The transaction behind a Stripe payment intent, shared by `refundLateStripeSuccess` and
 * `flagForManualReview` - both start from the same payment intent and need the same lookup, just
 * with different fields and a different not-found message.
 */
async function findTransactionBehindPaymentIntent(paymentIntentId: string) {
    const stripePayment = await prisma.stripePayment.findUnique({
        where: { paymentIntentId },
        select: {
            payment: {
                select: {
                    id: true,
                    claimedByTransactionId: true,
                    ledgerTransactions: { select: { id: true }, orderBy: { id: 'asc' }, take: 1 },
                },
            },
        },
    })

    const transactionId = stripePayment?.payment.ledgerTransactions[0]?.id
    if (!stripePayment || !transactionId) return undefined

    return {
        transactionId,
        paymentId: stripePayment.payment.id,
        claimedByTransactionId: stripePayment.payment.claimedByTransactionId,
    }
}

/**
 * Reimburses the payer when a Stripe payment intent succeeded but the local payment had already
 * moved to a terminal state that can't accept a success, which the catch block below handles as
 * a Prisma P2025 error. Neither side of the original transaction ever applied to anyone's ledger
 * balance, even though Stripe genuinely took the money. Idempotent: a webhook retry for the same
 * payment intent finds the payment already claimed and does nothing further.
 */
async function refundLateStripeSuccess(paymentIntentId: string, fee?: number) {
    const found = await findTransactionBehindPaymentIntent(paymentIntentId)
    if (!found) {
        logger.error(
            'MANUAL ADMIN ACTION REQUIRED! Could not find a transaction to reimburse for '
            + `late-succeeding payment intent ${paymentIntentId}.`
        )
        return
    }
    if (found.claimedByTransactionId !== null) return

    // Payment.fees is the single source of truth for what Stripe actually charged, but the
    // webhook's own guarded update above never got to write it here - that update targets a
    // payment already in a final state, which is exactly the P2025 this function exists to
    // handle. This is the only place that ever learns the real fee for this case, so write it
    // directly rather than threading it through reimburseUnappliedPayment's params.
    if (fee !== undefined) {
        await prisma.payment.update({ where: { id: found.paymentId }, data: { fees: fee } })
    }

    await reimburseOrLogManualAction(
        found.transactionId,
        'Stripe-betalingen gikk gjennom etter at den lokalt var kansellert eller mislyktes.',
    )
}

/**
 * Flags the transaction behind a payment intent for manual review - used for Stripe events that
 * represent money moving back out through Stripe itself (a dispute, or a refund issued directly
 * on Stripe's dashboard rather than through this app), which this codebase has no automated
 * handling for. A dispute silently taking money back is worse than a refund, so these can't be
 * left to just fall through as unsupported events the way a genuinely irrelevant one would.
 */
async function flagForManualReview(paymentIntentId: string, note: string) {
    const found = await findTransactionBehindPaymentIntent(paymentIntentId)
    if (!found) {
        logger.error(
            `MANUAL ADMIN ACTION REQUIRED! ${note} No ledger transaction found for payment intent ${paymentIntentId}.`
        )
        return
    }

    await manualReviewOperations.create({
        params: { transactionId: found.transactionId, problemDescription: note },
        bypassAuth: true,
    })
}

/**
 * The function which is called when we receive a payment intent event from Stripe.
 * It expects that the fields `latest_charge.balance_transaction` are expanded.
 * (This is configured in the Stripe dashboard.)
 *
 * @warning This callback assumes that the Stripe payment intents always have the capture method "automatic".
 * If this ever changes this function needs to be changed to handle uncaptured payments.
 * (That is payments which are authorized, but we have not actually taken the money yet.)
 *
 * This is not implemented using `ServiceMethod` because it does not need any of its features.
 * Firstly, the webhook callback is not part of the interface of the payment service.
 * This function will only ever be used one place. Secondly, authentication and data validation
 * is already handled by the Stripe package.
 *
 * @param paymentIntent The payment intent object received in the webhook.
 * It is expected that `latest_charge.balance_transaction` is expanded.
 *
 * @returns An appropriate `Response`.
 */
export async function stripeWebhookCallback(event: Stripe.Event): Promise<Response> {
    // Money moving back out through Stripe itself, outside anything this app initiated - flag it
    // and stop, rather than falling through to the "unsupported event" branch below as if it were
    // irrelevant.
    if (event.type === 'charge.refunded' || event.type === 'charge.dispute.created') {
        const charge = event.data.object as Stripe.Charge
        const paymentIntentId = typeof charge.payment_intent === 'string'
            ? charge.payment_intent
            : charge.payment_intent?.id
        if (!paymentIntentId) {
            logger.error(
                `MANUAL ADMIN ACTION REQUIRED! ${event.type} for charge ${charge.id} has no payment intent to look up.`
            )
            return new Response('', { status: 200 })
        }

        const note = event.type === 'charge.refunded'
            ? `Stripe-betalingen ble refundert direkte hos Stripe (${charge.amount_refunded} øre).`
            : 'Stripe-betalingen er bestridt av kortholderen (dispute).'
        await flagForManualReview(paymentIntentId, note)
        return new Response('', { status: 200 })
    }

    const paymentState = EVENT_TYPE_TO_STATE[event.type]

    if (!paymentState) {
        // We return a 200 response even for unsupported event
        // types to avoid unecessary retries from Stripe.
        logger.error(`Received unsupported Stripe event type: ${event.type}`)
        return new Response('', { status: 200 })
    }

    // TypeScript cannot figure out that the above if statement narrows the possible event type
    // so we'll have to assert this our selves
    const paymentIntent = event.data.object as Stripe.PaymentIntent

    // Declare fee, it will be undefined by default
    // which is what we want for the canceled and failed events
    let fee: number | undefined

    // If the payment succeeded we'll extract the fee
    if (event.type === 'payment_intent.succeeded') {
        fee = await retrieveStripeFees(paymentIntent)
    }

    // Cancel the payment intent on Stripe's side before marking anything FAILED locally below,
    // not after: canceling first closes the window where a retry with another card could still
    // succeed and only then get silently absorbed as a reimbursement instead of a normal
    // completed payment.
    if (event.type === 'payment_intent.payment_failed') {
        try {
            // No idempotency key: Stripe would otherwise replay this exact response - including a
            // transient 500 - on every retry of this event, stranding the payment in
            // PENDING/PROCESSING forever instead of letting a retry actually succeed.
            await stripe.paymentIntents.cancel(paymentIntent.id)
        } catch (err) {
            if (!(err instanceof Stripe.errors.StripeInvalidRequestError)) throw err

            // The cancel error itself doesn't reliably carry the intent's current status - look
            // it up directly instead of trusting err.payment_intent?.status.
            const currentPaymentIntent = await stripe.paymentIntents.retrieve(paymentIntent.id)

            // Stripe refuses to cancel an intent that already succeeded - it raced ahead of this
            // failure event. Don't mark anything FAILED in that case; its own success event,
            // handled normally above, is what should apply instead.
            if (currentPaymentIntent.status === 'succeeded') {
                logger.error(
                    `Payment intent ${paymentIntent.id} already succeeded on Stripe's side before its `
                    + 'failure event was handled - ignoring the failure; its success event applies instead.'
                )
                return new Response('', { status: 200 })
            }
            // Already canceled by an earlier delivery of this same event - continue on to mark
            // the payment FAILED below. Any other status is a real cancellation failure, left to
            // throw on purpose: the payment would stay PENDING/PROCESSING forever if the cancel
            // never actually goes through, so Stripe should keep retrying this event until it does.
            if (currentPaymentIntent.status !== 'canceled') throw err
        }
    }

    // Update the db model with the updated values.
    let stripePayment
    try {
        stripePayment = await prisma.stripePayment.update({
            where: {
                paymentIntentId: paymentIntent.id,
                payment: {
                    state: {
                        // Guard against changing final state
                        // This should never happen, but you can never be too careful
                        in: ['PENDING', 'PROCESSING', paymentState]
                    },
                },
            },
            data: {
                payment: {
                    update: {
                        fees: fee,
                        state: paymentState,
                    },
                }
            },
            select: {
                payment: {
                    select: {
                        id: true,
                        // Whether some transaction has already successfully claimed this payment -
                        // see the MANUAL ADMIN ACTION log below.
                        claimedByTransactionId: true,
                        // There's at most one PENDING transaction on a payment at this point in
                        // the flow, since a reimbursement referencing the same payment is only
                        // ever created later, in response to this very update's outcome.
                        ledgerTransactions: {
                            where: { state: 'PENDING' },
                            select: { id: true },
                            take: 1,
                        },
                    },
                },
            },
        })
    } catch (err) {
        // A P2025 here means the payment is already in a final state that conflicts with this
        // event, for example a stale or duplicate webhook delivered out of order. Log and stop
        // instead of throwing, which would make Stripe retry an event that can never succeed.
        if (err instanceof PrismaClientKnownRequestError && err.code === 'P2025') {
            logger.error(
                `Ignoring Stripe event for payment intent ${paymentIntent.id}: `
                + `payment is already in a state which conflicts with "${paymentState}".`
            )
            // Stripe genuinely captured the money even though our side had already moved on,
            // most likely because we canceled the payment locally moments before Stripe's
            // success event arrived. Nobody's ledger balance reflects a CANCELED or FAILED
            // transaction's entries, so credit the payer back.
            if (paymentState === 'SUCCEEDED') {
                await refundLateStripeSuccess(paymentIntent.id, fee)
            }
            return new Response('', { status: 200 })
        }

        throw err
    }

    const pendingTransaction = stripePayment.payment.ledgerTransactions[0]
    if (pendingTransaction) {
        // No user session exists here. Stripe's signature verification, already checked by the
        // route handler, is what authorizes this call.
        //
        // Wrapped in its own transaction (advance() itself never opens one, so it can also run
        // nested inside a caller's, e.g. create()'s) so the account lock advance() takes while
        // checking balances is actually held - a lock taken outside any transaction releases the
        // instant its own statement finishes, before the balance read it was meant to protect.
        // This matters here specifically: a duplicate webhook delivery for the same payment
        // intent is exactly the kind of concurrent advance() call that lock exists for.
        const transaction = await prisma.$transaction(async tx => ledgerTransactionOperations.advance({
            params: {
                id: pendingTransaction.id,
            },
            prisma: tx,
            bypassAuth: true,
        }))

        // The payment just succeeded, but the transaction still ended up FAILED here, most
        // commonly because an account involved was frozen after this very webhook arrived - or
        // CANCELED, if a user canceled the attempt while this very call was in flight. Either
        // way the entries never applied to anyone's balance, so reimburse the payer the same way
        // refundLateStripeSuccess does above.
        if (
            (transaction.state === 'FAILED' || transaction.state === 'CANCELED')
            && transaction.payment?.state === 'SUCCEEDED'
        ) {
            await reimburseOrLogManualAction(
                transaction.id,
                transaction.reason ?? 'Transaksjonen mislyktes etter at betalingen var gjennomført.'
            )
        }
    } else if (stripePayment.payment.claimedByTransactionId === null) {
        // Nothing has ever claimed this payment, and there's no PENDING transaction to advance
        // either - a real anomaly. A duplicate delivery of an event already handled by an
        // earlier one (the usual case for landing in this else branch) instead finds the payment
        // already claimed, and says nothing: logging on every repeat of a Stripe webhook would
        // bury real alerts under a steady stream of false ones.
        logger.error(
            'MANUAL ADMIN ACTION REQUIRED! Stripe payment has no pending ledger transaction to advance: '
            + `${stripePayment.payment.id}`
        )
    }

    return new Response('', { status: 200 })
}
