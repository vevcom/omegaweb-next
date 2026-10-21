import TransactionList from '@/components/Ledger/Transactions/LedgerTransactionList'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { getProfileForUserPage } from '@/app/users/[username]/(user-pages)/getProfileForUserPage'
import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ username: string }>) => {
        const { profile } = await getProfileForUserPage(params, 'account', session)

        return ledgerAccountOperations.read({ params: { userId: profile.user.id } })
    },
    render: ({ data: ledgerAccount }) => (
        <div className="bg-surface-base rounded-round p-(--card-padding) overflow-x-auto">
            <TransactionList accountId={ledgerAccount.id} />
        </div>
    ),
})

export default page
export { generateMetadata }
