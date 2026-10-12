'use client'

import LedgerTransactionModal from './LedgerTransactionModal'
import { displayAmount } from '@/lib/currency/convert'
import { createEventRegistrationPaymentAction } from '@/services/events/registration/actions'
import type { LedgerTransactionPaymentMethod } from './LedgerTransactionModal'
import type { ReactNode } from 'react'

type Props = {
    eventId: number,
    userId: number,
    price: number,
    triggerLabel: ReactNode,
    availableBalance?: number,
    availablePaymentMethods?: LedgerTransactionPaymentMethod[],
    customerSessionClientSecret?: string,
}

export default function ShopPaymentModal({
    eventId,
    userId,
    price,
    triggerLabel,
    availableBalance,
    availablePaymentMethods,
    customerSessionClientSecret,
}: Props) {
    return <LedgerTransactionModal
        popUpKey="shopPaymentModal"
        triggerLabel={triggerLabel}
        title="Kjøp"
        submitText="Kjøp"
        funds={price}
        availableBalance={availableBalance}
        availablePaymentMethods={availablePaymentMethods ?? ['STRIPE', 'MANUAL']}
        customerSessionClientSecret={customerSessionClientSecret}
        refreshOnSuccess
        onSubmitAction={({ paymentMethod, amountFromBalance, manualFees, description }) =>
            createEventRegistrationPaymentAction({
                params: {
                    userId,
                    eventId,
                    provider: paymentMethod,
                    amountFromBalance,
                    manualFees: manualFees ?? 0,
                    description,
                }
            })}
    >
        <p>Å betale: {displayAmount(price)}.</p>
    </LedgerTransactionModal>
}
