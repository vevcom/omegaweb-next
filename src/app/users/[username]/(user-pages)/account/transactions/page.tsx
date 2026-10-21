import TransactionList from '@/components/Ledger/Transactions/LedgerTransactionList'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { Require } from '@/auth/authorizer/Require'
import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        const { user } = Require.user()
            .auth(session).requireAuthorized().session

        return ledgerAccountOperations.read({ params: { userId: user.id } })
    },
    render: ({ data: ledgerAccount }) => (
        <div className="bg-surface-base rounded-round p-(--card-padding) overflow-x-auto">
            <TransactionList accountId={ledgerAccount.id} />
        </div>
    ),
})

export default page
export { generateMetadata }
