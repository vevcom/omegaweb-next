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

export default function EventPaymentModal({
    eventId,
    userId,
    price,
    triggerLabel,
    availableBalance,
    availablePaymentMethods,
    customerSessionClientSecret,
}: Props) {
    return <LedgerTransactionModal
        popUpKey="eventPaymentModal"
        triggerLabel={triggerLabel}
        title="Betal for påmelding"
        submitText="Betal"
        funds={price}
        availableBalance={availableBalance}
        availablePaymentMethods={availablePaymentMethods ?? ['STRIPE', 'MANUAL']}
        customerSessionClientSecret={customerSessionClientSecret}
        refreshOnSuccess
        onSubmitAction={({ paymentMethod, amountFromBalance, manualFees, description }) =>
            createEventRegistrationPaymentAction(
                { implementationParams: { userId, eventId } },
                {
                    params: {
                        provider: paymentMethod,
                        amountFromBalance,
                        manualFees: manualFees ?? 0,
                        description,
                    },
                },
            )}
    >
        <p>Dette arrangementet koster {displayAmount(price)}.</p>
    </LedgerTransactionModal>
}
