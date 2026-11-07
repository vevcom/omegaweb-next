import TransactionList from '@/components/Ledger/Transactions/LedgerTransactionList'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { ledgerTransactionAuth } from '@/services/ledger/transactions/auth'
import { capabilitiesToJsObject } from '@/auth/authorizer/capabilities'
import { getProfileForUserPage } from '@/app/(omegaweb)/users/[username]/(user-pages)/getProfileForUserPage'
import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ username: string }>) => {
        const { profile } = await getProfileForUserPage(params, 'account', session)

        return ledgerAccountOperations.read({ params: { userId: profile.user.id } })
    },
    capabilities: (ledgerAccount) => ({
        // Every transaction listed involves this account, so owning it makes the viewer a party.
        canCancel: ledgerTransactionAuth.cancel.data({ accounts: [ledgerAccount.ownership] }),
    }),
    render: ({ data: ledgerAccount, capabilities }) => (
        <div className="bg-surface-base rounded-round p-(--card-padding) overflow-x-auto">
            <TransactionList accountId={ledgerAccount.id} capabilities={capabilitiesToJsObject(capabilities)} />
        </div>
    ),
})

export default page
export { generateMetadata }
