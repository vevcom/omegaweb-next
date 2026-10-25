'use client'
import { connectEventToLedgerAccountAction } from '@/services/events/actions'
import { configureAction } from '@/services/configureAction'
import Form from '@/components/Form/Form'
import { SelectNumber } from '@/components/UI/Select'
import type { LedgerAccount } from '@/prisma-generated-pn-types'

export default function ConnectEventToLedgerForm({
    eventId,
    currentLedgerAccountId,
    ledgerAccounts,
}: {
    eventId: number,
    currentLedgerAccountId: number | null,
    ledgerAccounts: Pick<LedgerAccount, 'id' | 'name'>[],
}) {
    if (ledgerAccounts.length === 0) return <p>Du har ingen gruppekontoer å knytte arrangementet til.</p>

    return <Form
        action={configureAction(connectEventToLedgerAccountAction, { params: { id: eventId } })}
        submitText="Knytt til konto"
        refreshOnSuccess
        closePopUpOnSuccess="EditEvent"
    >
        <SelectNumber
            name="ledgerAccountId"
            label="Konto betalinger går til"
            defaultValue={currentLedgerAccountId ?? undefined}
            options={ledgerAccounts.map(account => ({
                label: account.name ?? `Konto ${account.id}`,
                value: account.id,
            }))}
        />
    </Form>
}
