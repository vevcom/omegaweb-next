import Card from '@/components/UI/Card'
import TransactionList from '@/components/Ledger/Transactions/LedgerTransactionList'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { getProfileForUserPage } from '@/app/(omegaweb)/users/[username]/(user-pages)/getProfileForUserPage'
import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ username: string }>) => {
        const { profile } = await getProfileForUserPage(params, 'account', session)

        return ledgerAccountOperations.read({ params: { userId: profile.user.id } })
    },
    render: ({ data: ledgerAccount }) => (
        <Card className="overflow-x-auto">
            <TransactionList accountId={ledgerAccount.id} />
        </Card>
    ),
})

export default page
export { generateMetadata }
