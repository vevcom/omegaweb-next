import styles from './page.module.scss'
import TransactionList from '@/components/Ledger/Transactions/LedgerTransactionList'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { Require } from '@/auth/authorizer/Require'
import { serverPage } from '@/app/serverPage'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        const { user } = Require.user()
            .auth(session).requireAuthorized().session

        return ledgerAccountOperations.read({ params: { userId: user.id } })
    },
    render: ({ data: ledgerAccount }) => (
        <div className={styles.wrapper}>
            <TransactionList accountId={ledgerAccount.id} />
        </div>
    ),
})

export default page
export { generateMetadata }
