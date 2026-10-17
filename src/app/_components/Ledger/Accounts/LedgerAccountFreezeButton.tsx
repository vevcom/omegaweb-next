'use client'

import Button from '@/components/UI/Button'
import { updateLedgerAccountAction, updateLedgerAccountAsAdminAction } from '@/services/ledger/accounts/actions'
import { useRouter } from 'next/navigation'
import type { LedgerAccount } from '@/prisma-generated-pn-types'

export default function LedgerAccountFreezeButton({
    ledgerAccount,
    className
}: { ledgerAccount: LedgerAccount, className?: string }) {
    const { refresh } = useRouter()

    const toggleFrozen = async () => {
        const params = { ledgerAccountId: ledgerAccount.id }
        // Freezing is owner-level (update); unfreezing takes LEDGER_ADMIN (updateAsAdmin). This
        // button is only rendered at all when the session can do the direction it's about to
        // perform (see canFreeze), so there's nothing left to check here, just which action fits.
        if (ledgerAccount.frozen) {
            await updateLedgerAccountAsAdminAction({ params }, { data: { frozen: false } })
        } else {
            await updateLedgerAccountAction({ params }, { data: { frozen: true } })
        }
        refresh()
    }

    return (
        <Button color="secondary" className={className} onClick={toggleFrozen}>
            {ledgerAccount.frozen ? 'Tin konto' : 'Frys konto'}
        </Button>
    )
}
