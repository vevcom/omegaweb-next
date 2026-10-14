'use client'
import { connectCabinToLedgerAction } from '@/services/cabin/booking/actions'
import Form from '@/components/Form/Form'
import { SelectNumber } from '@/components/UI/Select'
import type { LedgerAccount } from '@/prisma-generated-pn-types'

export default function ConnectCabinToLedgerForm({
    currentLedgerAccountId,
    ledgerAccounts,
}: {
    currentLedgerAccountId: number | null,
    ledgerAccounts: Pick<LedgerAccount, 'id' | 'name'>[],
}) {
    if (ledgerAccounts.length === 0) return <p>Du har ingen gruppekontoer å knytte hytta til.</p>

    return <Form
        action={connectCabinToLedgerAction}
        submitText="Knytt til konto"
        refreshOnSuccess
        closePopUpOnSuccess="cabinSettings"
    >
        <SelectNumber
            name="ledgerAccountId"
            label="Konto"
            defaultValue={currentLedgerAccountId ?? undefined}
            options={ledgerAccounts.map(account => ({
                label: account.name ?? `Konto ${account.id}`,
                value: account.id,
            }))}
        />
    </Form>
}
