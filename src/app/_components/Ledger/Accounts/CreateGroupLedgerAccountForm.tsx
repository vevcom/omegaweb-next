'use client'

import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import { createLedgerAccountAction } from '@/services/ledger/accounts/actions'
import type { PopUpKeyType } from '@/contexts/PopUp'

type Props = {
    popUpKey: PopUpKeyType,
}

// Groups are attached to the account afterwards, from its own detail page
// (LedgerAccountGroupsCard) - not chosen up front here.
export default function CreateGroupLedgerAccountForm({ popUpKey }: Props) {
    return (
        <Form
            title="Ny gruppekonto"
            submitText="Opprett konto"
            action={createLedgerAccountAction}
            closePopUpOnSuccess={popUpKey}
            refreshOnSuccess
        >
            <TextInput name="name" label="Navn" required />
            <TextInput name="payoutAccountNumber" label="Utbetalingskontonummer" />
        </Form>
    )
}
