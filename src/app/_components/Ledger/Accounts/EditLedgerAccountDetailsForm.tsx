'use client'

import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import { updateLedgerAccountAction } from '@/services/ledger/accounts/actions'
import { configureAction } from '@/services/configureAction'
import type { PopUpKeyType } from '@/contexts/PopUp'
import type { LedgerAccount } from '@/prisma-generated-pn-types'

type Props = {
    ledgerAccount: LedgerAccount,
    popUpKey: PopUpKeyType,
}

export default function EditLedgerAccountDetailsForm({ ledgerAccount, popUpKey }: Props) {
    return (
        <Form
            title="Rediger konto"
            submitText="Lagre"
            action={configureAction(updateLedgerAccountAction, { params: { ledgerAccountId: ledgerAccount.id } })}
            closePopUpOnSuccess={popUpKey}
            refreshOnSuccess
        >
            <TextInput name="name" label="Navn" defaultValue={ledgerAccount.name ?? ''} />
            <TextInput
                name="payoutAccountNumber"
                label="Utbetalingskontonummer"
                defaultValue={ledgerAccount.payoutAccountNumber ?? ''}
            />
        </Form>
    )
}
