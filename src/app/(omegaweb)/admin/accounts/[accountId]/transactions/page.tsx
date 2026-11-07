import TransactionList from '@/components/Ledger/Transactions/LedgerTransactionList'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { ledgerTransactionAuth } from '@/services/ledger/transactions/auth'
import { capabilitiesToJsObject } from '@/auth/authorizer/capabilities'
import { serverPage } from '@/app/ServerPage'
import { notFound } from 'next/navigation'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params }: PageOperationArgs<{ accountId: string }>) => {
        const accountId = Number(params.accountId)

        if (!accountId) {
            notFound()
        }

        return ledgerAccountOperations.read({ params: { ledgerAccountId: accountId } })
    },
    capabilities: (ledgerAccount) => ({
        // Every transaction listed involves this account, so owning it makes the viewer a party.
        canCancel: ledgerTransactionAuth.cancel.data({ accounts: [ledgerAccount.ownership] }),
    }),
    render: ({ data: ledgerAccount, capabilities }) => (
        <div className="bg-surface-base rounded-round p-(--card-padding)">
            <TransactionList accountId={ledgerAccount.id} capabilities={capabilitiesToJsObject(capabilities)} />
        </div>
    ),
})

export default page
export { generateMetadata }
