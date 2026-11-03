'use client'
import { connectEventToLedgerAccountAction } from '@/services/events/actions'
import { configureAction } from '@/services/configureAction'
import Form from '@/components/Form/Form'
import { SelectNumber } from '@/components/UI/Select'
import type { LedgerAccount } from '@/prisma-generated-pn-types'

type Account = Pick<LedgerAccount, 'id' | 'name'>

/** The account the payments for the event go to, for those who administrate the event. */
export default function ConnectEventToLedgerForm({ eventId, ledgerAccount, ledgerAccounts }: {
    eventId: number,
    /** The account the event is linked to now, if any. */
    ledgerAccount: Account | null,
    /** The group accounts the session may link the event to. */
    ledgerAccounts: Account[],
}) {
    return <div className="
        flex flex-col gap-4 min-w-[min(80vw,28rem)]
        [&>h2]:m-0
        [&>p]:m-0
    ">
        <h2>Betaling</h2>
        <p>
            {ledgerAccount
                ? `Betalingene går til kontoen ${accountName(ledgerAccount)}.`
                : 'Arrangementet er ikke knyttet til en konto, så betaling fungerer ikke ennå.'}
        </p>
        {ledgerAccounts.length === 0
            ? <p className="text-text-muted">Du har ingen gruppekontoer å knytte arrangementet til.</p>
            : <Form
                action={configureAction(connectEventToLedgerAccountAction, { params: { id: eventId } })}
                submitText="Knytt til konto"
                refreshOnSuccess
                closePopUpOnSuccess="EventLedgerAccount"
            >
                <SelectNumber
                    name="ledgerAccountId"
                    label="Konto betalinger går til"
                    defaultValue={ledgerAccount?.id}
                    options={ledgerAccounts.map(account => ({ label: accountName(account), value: account.id }))}
                />
            </Form>}
    </div>
}

function accountName(account: Account) {
    return account.name ?? `Konto ${account.id}`
}
