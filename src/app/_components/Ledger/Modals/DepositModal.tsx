'use client'

import LedgerTransactionModal from './LedgerTransactionModal'
import NumberInput from '@/components/UI/NumberInput'
import { convertAmount } from '@/lib/currency/convert'
import { MINIMUM_PAYMENT_AMOUNT } from '@/services/ledger/payments/constants'
import { createDepositAction } from '@/services/ledger/movements/actions'
import { useState } from 'react'
import type { LedgerTransactionPaymentMethod } from './LedgerTransactionModal'

type Props = {
    ledgerAccountId: number,
    customerSessionClientSecret?: string,
    availablePaymentMethods?: LedgerTransactionPaymentMethod[],
}

export default function DepositModal({ ledgerAccountId, customerSessionClientSecret, availablePaymentMethods }: Props) {
    const [funds, setFunds] = useState(MINIMUM_PAYMENT_AMOUNT)

    return <LedgerTransactionModal
        popUpKey="depositModal"
        triggerLabel="Sett inn"
        title="Nytt innskudd"
        submitText="Sett inn"
        funds={funds}
        showTotal={false}
        availablePaymentMethods={availablePaymentMethods ?? ['STRIPE', 'MANUAL']}
        customerSessionClientSecret={customerSessionClientSecret}
        refreshOnSuccess
        onSubmitAction={({ paymentMethod, manualFees, description }) => createDepositAction({
            params: {
                ledgerAccountId,
                funds,
                provider: paymentMethod!,
                manualFees: manualFees ?? 0,
                description,
            }
        })}
    >
        <NumberInput
            label="Beløp"
            name="funds"
            step={1}
            min={MINIMUM_PAYMENT_AMOUNT / 100}
            defaultValue={funds / 100}
            onChange={e => setFunds(convertAmount(e.target.value))}
            required
        />
    </LedgerTransactionModal>
}
