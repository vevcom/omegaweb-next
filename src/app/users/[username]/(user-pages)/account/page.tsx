import styles from './page.module.scss'
import LedgerAccountOverview from '@/components/Ledger/Accounts/LedgerAccountOverviewCard'
import LedgerAccountPaymentMethods from '@/components/Ledger/Accounts/LedgerAccountPaymentMethodsCard'
import LedgerAccountTransactionSummary from '@/components/Ledger/Accounts/LedgerAccountTransactionSummaryCard'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { Require } from '@/auth/authorizer/Require'
import { serverPage } from '@/app/serverPage'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        const { user } = Require.user()
            .auth(session).requireAuthorized().session

        const ledgerAccount = await ledgerAccountOperations.read({ params: { userId: user.id } })
        return { ledgerAccount, userId: user.id }
    },
    render: ({ data }) => (
        <div className={styles.wrapper}>
            <LedgerAccountOverview
                ledgerAccount={data.ledgerAccount}
                showPayoutButton
                showDepositButton
                showDeactivateButton
                showFees
            />
            <LedgerAccountPaymentMethods userId={data.userId} />
            <LedgerAccountTransactionSummary transactionsHref="account/transactions" />
        </div>
    ),
})

export default page
export { generateMetadata }
