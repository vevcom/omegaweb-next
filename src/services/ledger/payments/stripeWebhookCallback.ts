import logger from '@/lib/logger'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/prisma/client'
import { ledgerTransactionOperations } from '@/services/ledger/transactions/operations'
import { manualReviewOperations } from '@/services/ledger/transactions/manualReviews/operations'
import { manualReviewProblemDescriptions } from '@/services/ledger/transactions/manualReviews/constants'
import { displayAmount } from '@/lib/currency/convert'
import Stripe from 'stripe'
import type { ManualReviewProblem, PaymentState } from '@/prisma-generated-pn-types'

/**
 * Handles a Stripe event, called by api/stripe-events/route.ts once it has checked the signature.
 * A thrown error becomes a 500, which makes Stripe retry the event later.
 *
 * @warning This assumes payment intents always use the capture method "automatic". Payments that
 * are only authorized, not captured, would need handling of their own.
 */
export async function stripeWebhookCallback(event: Stripe.Event): Promise<Response> {
    switch (event.type) {
        case 'payment_intent.succeeded': {
            const paymentIntentId = event.data.object.id
            await recordPaymentState(paymentIntentId, 'SUCCEEDED', await retrieveStripeFee(paymentIntentId))
            break
        }
        case 'payment_intent.payment_failed':
            if (await cancelFailedIntent(event.data.object.id)) {
                await recordPaymentState(event.data.object.id, 'FAILED')
            }
            break
        case 'payment_intent.canceled':
            await recordPaymentState(event.data.object.id, 'CANCELED')
            break
        // Money leaving through Stripe itself, outside anything this app initiated.
        case 'charge.refunded':
            await flagForManualReview(
                event.data.object.payment_intent,
                'STRIPE_REFUND',
                `${manualReviewProblemDescriptions.STRIPE_REFUND} `
                + `Refundert beløp: ${displayAmount(event.data.object.amount_refunded, false)}.`,
            )
            break
        case 'charge.dispute.created':
            await flagForManualReview(event.data.object.payment_intent, 'STRIPE_DISPUTE')
            break
        default:
            logger.error(`Received unsupported Stripe event type: ${event.type}`)
    }

    // Acknowledged even when nothing was done, since a retry would not change that.
    return new Response('', { status: 200 })
}

/**
 * Records the payment's new state, then advances its PENDING transaction. A success is recorded
 * whatever the local state, since the money has arrived. If no transaction ends up claiming it,
 * for example because it was canceled locally, the ledger sweeper reimburses the payer.
 */
async function recordPaymentState(paymentIntentId: string, state: PaymentState, fees?: number) {
    const { count } = await prisma.payment.updateMany({
        where: {
            stripePayment: { paymentIntentId },
            // A failure or cancellation must not overwrite a final state, for example after a
            // stale or duplicate event delivered out of order.
            ...(state !== 'SUCCEEDED' && { state: { in: ['PENDING', 'PROCESSING', state] } }),
        },
        data: { state, fees },
    })
    if (count === 0) {
        // A success is never guarded, so it only matches nothing when no payment here has the intent.
        if (state === 'SUCCEEDED') {
            await flagForManualReview(
                paymentIntentId,
                'UNCLAIMED_PAYMENT',
                'Stripe-betaling gikk gjennom, men ingen betaling her hører til den.',
            )
            return
        }
        logger.error(
            `Ignored a Stripe ${state} event for payment intent ${paymentIntentId}: either no payment here `
            + 'has that intent, or its payment is already final. The latter is expected for a declined card, '
            + 'which reports both FAILED and CANCELED. No money moved, so nothing needs doing.'
        )
        return
    }

    // There's at most one PENDING transaction on a payment, since a reimbursement reusing it is only
    // created once none is PENDING.
    const pendingTransaction = await prisma.ledgerTransaction.findFirst({
        where: { state: 'PENDING', payment: { stripePayment: { paymentIntentId } } },
        select: { id: true },
    })
    if (!pendingTransaction) return

    // Authorized by Stripe's signature. Runs in a transaction so the account lock advance() takes is
    // held through its balance check.
    await prisma.$transaction(tx => ledgerTransactionOperations.internal.advance.internalCall({
        params: { id: pendingTransaction.id },
        prisma: tx,
    }))
}

/**
 * The fee Stripe took for a succeeded payment intent. With automatic capture, its latest charge is
 * the only one that moved money. Throws while the fee is not known yet, so Stripe retries.
 */
async function retrieveStripeFee(paymentIntentId: string): Promise<number> {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ['latest_charge.balance_transaction'],
    })
    const charge = paymentIntent.latest_charge
    const balanceTransaction = typeof charge === 'object' ? charge?.balance_transaction : null
    if (!balanceTransaction || typeof balanceTransaction !== 'object') {
        throw new Error(`Payment intent ${paymentIntentId} has no balance transaction to read its fee from.`)
    }
    return balanceTransaction.fee
}

/**
 * Cancels a failed payment intent on Stripe before it is marked FAILED here, so a retry with
 * another card can't succeed afterwards. Returns false if the intent succeeded in the meantime,
 * in which case its own success event applies instead of this failure.
 */
async function cancelFailedIntent(paymentIntentId: string): Promise<boolean> {
    try {
        // No idempotency key: Stripe would otherwise replay a transient failure on every retry of
        // this event, leaving the payment PROCESSING for good.
        await stripe.paymentIntents.cancel(paymentIntentId)
        return true
    } catch (error) {
        if (!(error instanceof Stripe.errors.StripeInvalidRequestError)) throw error

        // The cancel error doesn't reliably carry the intent's status, so look it up.
        const { status } = await stripe.paymentIntents.retrieve(paymentIntentId)
        if (status === 'succeeded') return false
        // Canceled by an earlier delivery is fine. Anything else throws, so Stripe retries.
        if (status !== 'canceled') throw error
        return true
    }
}

/**
 * Flags the payment behind a payment intent for manual review, for example after a dispute. The
 * payment intent goes in the description, since it finds the payment on Stripe's dashboard and is
 * all an admin has to go on when no payment here has it.
 */
async function flagForManualReview(
    paymentIntent: string | Stripe.PaymentIntent | null,
    problem: ManualReviewProblem,
    problemDescription = manualReviewProblemDescriptions[problem],
) {
    const paymentIntentId = typeof paymentIntent === 'string' ? paymentIntent : paymentIntent?.id
    const payment = paymentIntentId ? await prisma.payment.findFirst({
        where: { stripePayment: { paymentIntentId } },
        select: { id: true },
    }) : null

    await manualReviewOperations.internal.create.internalCall({
        params: {
            paymentId: payment?.id,
            problem,
            problemDescription: `${problemDescription} (payment intent ${paymentIntentId ?? 'ukjent'})`,
        },
    })
}
