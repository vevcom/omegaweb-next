'use client'

import Form from '@/components/Form/Form'
import { updateLedgerAccountAction, updateLedgerAccountAsAdminAction } from '@/services/ledger/accounts/actions'
import type { LedgerAccount } from '@/prisma-generated-pn-types'

const freezeWarning = 'Dersom du mistenker at kontoen din er misbrukt, kan du fryse den. ' +
    'Alle transaksjoner knyttet til kontoen blokkeres da, og kun en administrator kan oppheve frysingen. ' +
    'Er du sikker på at du vil fryse kontoen?'

export default function LedgerAccountFreezeButton({
    ledgerAccount,
    className
}: { ledgerAccount: LedgerAccount, className?: string }) {
    const params = { ledgerAccountId: ledgerAccount.id }

    // Freezing is owner-level (update); unfreezing takes LEDGER_ADMIN (updateAsAdmin). This
    // button is only rendered at all when the session can do the direction it's about to
    // perform (see canFreeze), so there's nothing left to check here, just which action fits.
    // Only an admin can undo a freeze, so the owner is warned before doing it.
    return (
        <Form
            className={`
                w-fit!
                ${className ?? ''}
            `}
            submitText={ledgerAccount.frozen ? 'Tin konto' : 'Frys konto'}
            submitColor="secondary"
            confirmation={{ confirm: !ledgerAccount.frozen, text: freezeWarning }}
            refreshOnSuccess
            action={ledgerAccount.frozen
                ? () => updateLedgerAccountAsAdminAction({ params }, { data: { frozen: false } })
                : () => updateLedgerAccountAction({ params }, { data: { frozen: true } })}
        />
    )
}
