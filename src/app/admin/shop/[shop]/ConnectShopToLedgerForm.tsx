'use client'
import { connectShopToLedgerAction } from '@/services/shop/actions'
import { configureAction } from '@/services/configureAction'
import Form from '@/app/_components/Form/Form'
import { SelectNumber } from '@/app/_components/UI/Select'
import type { LedgerAccount } from '@/prisma-generated-pn-types'

export default function ConnectShopToLedgerForm({
    shopId,
    currentLedgerAccountId,
    ledgerAccounts,
}: {
    shopId: number,
    currentLedgerAccountId: number | null,
    ledgerAccounts: Pick<LedgerAccount, 'id' | 'name'>[],
}) {
    if (ledgerAccounts.length === 0) return <p>Du har ingen gruppekontoer å knytte butikken til.</p>

    return <Form
        action={configureAction(connectShopToLedgerAction, { params: { shopId } })}
        submitText="Knytt til konto"
        refreshOnSuccess
        closePopUpOnSuccess="connectShopToLedger"
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
