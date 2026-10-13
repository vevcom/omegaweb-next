'use client'

import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import { updateLedgerAccountAction } from '@/services/ledger/accounts/actions'
import { configureAction } from '@/services/configureAction'
import type { CapabilitiesJsObject } from '@/auth/authorizer/capabilities'
import type { PopUpKeyType } from '@/contexts/PopUp'
import type { LedgerAccount } from '@/prisma-generated-pn-types'

type Props = {
    ledgerAccount: LedgerAccount,
    popUpKey: PopUpKeyType,
    capabilities: CapabilitiesJsObject<'canChangePayout'>,
}

export default function EditLedgerAccountDetailsForm({ ledgerAccount, popUpKey, capabilities }: Props) {
    return (
        <Form
            title="Rediger konto"
            submitText="Lagre"
            action={configureAction(updateLedgerAccountAction, { params: { ledgerAccountId: ledgerAccount.id } })}
            closePopUpOnSuccess={popUpKey}
            refreshOnSuccess
        >
            <TextInput name="name" label="Navn" defaultValue={ledgerAccount.name ?? ''} />
            {capabilities.canChangePayout.authorized && (
                <TextInput
                    name="payoutAccountNumber"
                    label="Utbetalingskontonummer"
                    defaultValue={ledgerAccount.payoutAccountNumber ?? ''}
                />
            )}
        </Form>
    )
}
