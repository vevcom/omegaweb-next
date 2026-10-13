import styles from './page.module.scss'
import LedgerAccountOverview from '@/components/Ledger/Accounts/LedgerAccountOverviewCard'
import LedgerAccountPaymentMethods from '@/components/Ledger/Accounts/LedgerAccountPaymentMethodsCard'
import LedgerAccountTransactionSummary from '@/components/Ledger/Accounts/LedgerAccountTransactionSummaryCard'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { ledgerAccountAuth } from '@/services/ledger/accounts/auth'
import { ledgerMovementAuth } from '@/services/ledger/movements/auth'
import { Require } from '@/auth/authorizer/Require'
import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        const { user } = Require.user()
            .auth(session).requireAuthorized().session

        const ledgerAccount = await ledgerAccountOperations.read({ params: { userId: user.id } })
        return { ledgerAccount, userId: user.id }
    },
    capabilities: (data) => ({
        canDeposit: ledgerMovementAuth.createDeposit,
        canPayout: ledgerMovementAuth.createPayout.data({ accounts: [data.ledgerAccount.ownership] }),
        // Unfreezing takes more than freezing, so the rule follows the state the button changes.
        canFreeze: ledgerAccountAuth.update({
            accounts: [data.ledgerAccount.ownership],
            changesAdminFields: data.ledgerAccount.frozen,
        }),
    }),
    render: ({ data, capabilities }) => (
        <div className={styles.wrapper}>
            <LedgerAccountOverview
                ledgerAccount={data.ledgerAccount}
                capabilities={capabilities}
                showFees
            />
            <LedgerAccountPaymentMethods userId={data.userId} />
            <LedgerAccountTransactionSummary transactionsHref="account/transactions" />
        </div>
    ),
})

export default page
export { generateMetadata }
