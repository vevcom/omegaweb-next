'use client'

import Form from '@/components/Form/Form'
import PopUp from '@/components/PopUp/PopUp'
import NumberInput from '@/components/UI/NumberInput'
import Checkbox from '@/components/UI/Checkbox'
import TextInput from '@/components/UI/TextInput'
import Button from '@/components/UI/Button'
import HorizontalSelector from '@/components/UI/HorizontalSelector'
import { displayAmount, convertAmount } from '@/lib/currency/convert'
import { createActionError } from '@/services/actionError'
import useAuthorizer from '@/hooks/useAuthorizer'
import { paymentAuth } from '@/services/ledger/payments/auth'
import { readLedgerTransactionStateByPaymentAction } from '@/services/ledger/transactions/actions'
import { lazy, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { PopUpKeyType } from '@/contexts/PopUp'
import type { ActionReturn } from '@/services/actionTypes'
import type { ExpandedPayment } from '@/services/ledger/payments/types'
import type { StripePaymentRef } from '@/components/Stripe/StripePayment'

// Avoid loading the Stripe components until they are needed
const StripePayment = lazy(() => import('@/components/Stripe/StripePayment'))
const StripeProvider = lazy(() => import('@/components/Stripe/StripeProvider'))

const SETTLE_POLL_INTERVAL_MS = 500
const SETTLE_TIMEOUT_MS = 10_000

/**
 * Waits for the Stripe webhook to settle the transaction a confirmed payment was made for, so the
 * page refreshes with the new balance. Gives up after a while and returns PENDING, since the webhook
 * will still settle it later. This is not so clean, but works for now.
 */
async function waitForSettledTransaction(paymentId: number) {
    const deadline = Date.now() + SETTLE_TIMEOUT_MS
    while (Date.now() < deadline) {
        const result = await readLedgerTransactionStateByPaymentAction({ params: { paymentId } })
        if (!result.success) break
        if (result.data !== 'PENDING') return result.data
        await new Promise(resolve => setTimeout(resolve, SETTLE_POLL_INTERVAL_MS))
    }
    return 'PENDING'
}

export type LedgerTransactionPaymentMethod = 'STRIPE' | 'MANUAL'

const paymentMethodNames: Record<LedgerTransactionPaymentMethod, string> = {
    STRIPE: 'Stripe',
    MANUAL: 'Manuell betaling',
}

export type LedgerTransactionSelection = {
    amountFromBalance: number,
    shortfall: number,
    paymentMethod?: LedgerTransactionPaymentMethod,
    manualFees?: number,
    description?: string,
}

type Props = {
    popUpKey: PopUpKeyType,
    triggerLabel: ReactNode,
    title: string,
    children: ReactNode,
    funds: number,
    // Hide the total row in the footer when it would just repeat a single obvious input from
    // `children` (e.g. deposit/payout, which are already just one amount field).
    showTotal?: boolean,
    availableBalance?: number,
    // Which methods this flow conceptually supports. MANUAL's admin-exclusivity is enforced
    // internally (see `paymentMethods` below) — callers don't need to filter it themselves.
    availablePaymentMethods: LedgerTransactionPaymentMethod[],
    customerSessionClientSecret?: string,
    submitText?: string,
    refreshOnSuccess?: boolean,
    onSubmitAction: (selection: LedgerTransactionSelection) => Promise<ActionReturn<{ payment: ExpandedPayment | null }>>,
}

/**
 * The one central modal for every ledger transaction (deposits, payouts, and, later, shop/event
 * payments). It owns no business logic and calls no server action itself: the caller supplies
 * `children` (whatever describes what's being paid for/withdrawn) and `onSubmitAction` (which calls
 * whichever domain-specific action actually creates the transaction). It must resolve to
 * an `ActionReturn` carrying a `payment` field, which is all this modal needs to know whether a
 * Stripe confirmation step is required next.
 */
export default function LedgerTransactionModal({
    popUpKey,
    triggerLabel,
    title,
    children,
    funds,
    showTotal = true,
    availableBalance,
    availablePaymentMethods,
    customerSessionClientSecret,
    submitText = 'Bekreft',
    refreshOnSuccess,
    onSubmitAction,
}: Props) {
    const canPayManually = useAuthorizer({
        authorizer: paymentAuth.create({ provider: 'MANUAL' })
    }).authorized

    // MANUAL is only ever a legitimate choice when it's offered alongside a real alternative (i.e.
    // as a deliberate bypass of the normal payment flow) and the payment rule allows it - enforced
    // here so callers never need to re-derive it themselves. When MANUAL is the *only* method a
    // caller offers (e.g. a payout, which has no alternative provider at all), there's nothing to
    // bypass, so it's left as-is; authorization for that case is the caller's own domain rule
    // (e.g. account ownership), not this exclusivity rule.
    const paymentMethods = availablePaymentMethods.length > 1
        ? availablePaymentMethods.filter(method => method !== 'MANUAL' || canPayManually)
        : availablePaymentMethods

    const amountFromBalance = availableBalance ? Math.min(availableBalance, funds) : 0
    const shortfall = funds - amountFromBalance
    // Only treat the balance as having covered the whole thing once it's actually contributing
    // something. Otherwise `funds === 0` (e.g. the amount field is empty/being retyped) would
    // read the same as "balance covers it", hiding the payment method fields while editing.
    const coveredByBalance = amountFromBalance > 0 && shortfall <= 0

    const showChooser = !coveredByBalance && paymentMethods.length > 1

    const [selectedMethod, setSelectedMethod] = useState<LedgerTransactionPaymentMethod | undefined>(
        paymentMethods[0]
    )
    const [manualFees, setManualFees] = useState(0)
    const [description, setDescription] = useState('')

    const resolvedMethod = selectedMethod && paymentMethods.includes(selectedMethod)
        ? selectedMethod
        : paymentMethods[0]
    const paymentMethod = coveredByBalance ? undefined : resolvedMethod

    const stripePaymentRef = useRef<StripePaymentRef>(null)

    const confirmPayment = async (payment: ExpandedPayment) => {
        // Stripe payments are the only payments that need confirmation
        if (payment.provider !== 'STRIPE') return null

        const clientSecret = payment.stripePayment?.clientSecret
        if (!clientSecret) return 'Noe gikk galt ved opprettelse av betalingen.'

        const current = stripePaymentRef.current
        if (!current) return 'Noe gikk galt da Stripe skulle lastes inn.'

        return await current.confirmPayment(clientSecret)
    }

    const handleSubmit = async () => {
        if (paymentMethod === 'STRIPE' && stripePaymentRef.current) {
            const submitError = await stripePaymentRef.current.submit()
            if (submitError) return createActionError('UNKNOWN ERROR', submitError)
        }

        const result = await onSubmitAction({
            amountFromBalance,
            shortfall,
            paymentMethod,
            manualFees: paymentMethod === 'MANUAL' ? manualFees : undefined,
            description: paymentMethod === 'MANUAL' && canPayManually ? (description || undefined) : undefined,
        })
        if (!result.success) return result

        const payment = result.data.payment
        if (payment?.state === 'PROCESSING') {
            const confirmError = await confirmPayment(payment)
            if (confirmError) return createActionError('UNKNOWN ERROR', confirmError)

            const state = await waitForSettledTransaction(payment.id)
            if (state === 'FAILED' || state === 'CANCELED') {
                return createActionError('UNKNOWN ERROR', 'Betalingen gikk ikke gjennom.')
            }
        }

        return { success: true, data: undefined } as const
    }

    return <PopUp
        popUpKey={popUpKey}
        customShowButton={(open) => <Button onClick={open} color="primary">{triggerLabel}</Button>}
    >
        <div className="w-[min(500px,calc(100svw-3rem))]">
            <h2>{title}</h2>

            <Form
                action={handleSubmit}
                submitText={submitText}
                refreshOnSuccess={refreshOnSuccess}
                closePopUpOnSuccess={popUpKey}
            >
                {children}

                {showChooser && resolvedMethod && (
                    <div className="flex flex-col">
                        <span className="text-s mb-2 text-text-muted">Betal med</span>
                        <HorizontalSelector
                            name="paymentMethod"
                            value={resolvedMethod}
                            onChange={setSelectedMethod}
                            options={paymentMethods.map(method => ({
                                value: method,
                                label: paymentMethodNames[method],
                            }))}
                        />
                    </div>
                )}

                {paymentMethod === 'STRIPE' && (
                    <StripeProvider
                        mode="payment"
                        amount={shortfall}
                        customerSessionClientSecret={customerSessionClientSecret}
                    >
                        <StripePayment ref={stripePaymentRef} />
                    </StripeProvider>
                )}

                {paymentMethod === 'MANUAL' && (
                    <div className="flex flex-col gap-2">
                        {paymentMethods.length > 1 && (
                            <Checkbox name="iUseThisWithCare" required>Jeg bruker dette med omhu.</Checkbox>
                        )}
                        <NumberInput
                            label="Avgifter"
                            name="manualFees"
                            step={1}
                            min={0}
                            defaultValue={0}
                            onChange={e => setManualFees(convertAmount(e.target.value))}
                            required
                        />
                        {canPayManually && (
                            <TextInput
                                label="Kommentar"
                                name="description"
                                onChange={e => setDescription(e.target.value)}
                            />
                        )}
                    </div>
                )}

                {showTotal && (
                    <div className="flex justify-between font-bold">
                        <span>Totalt</span>
                        <span>{displayAmount(funds, false)}</span>
                    </div>
                )}
                {amountFromBalance > 0 && (
                    <div className="flex justify-between text-text-muted">
                        <span>Fra kontosaldo</span>
                        <span>-{displayAmount(amountFromBalance, false)}</span>
                    </div>
                )}
            </Form>
        </div>
    </PopUp>
}
