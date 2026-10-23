import LedgerAccountOverview from '@/components/Ledger/Accounts/LedgerAccountOverviewCard'
import LedgerAccountPaymentMethods from '@/components/Ledger/Accounts/LedgerAccountPaymentMethodsCard'
import LedgerAccountTransactionSummary from '@/components/Ledger/Accounts/LedgerAccountTransactionSummaryCard'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { ledgerAccountAuth } from '@/services/ledger/accounts/auth'
import { ledgerMovementAuth } from '@/services/ledger/movements/auth'
import { Require } from '@/auth/authorizer/Require'
import { getProfileForUserPage } from '@/app/(omegaweb)/users/[username]/(user-pages)/getProfileForUserPage'
import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ username: string }>) => {
        const { profile } = await getProfileForUserPage(params, 'account', session)

        const ledgerAccount = await ledgerAccountOperations.read({ params: { userId: profile.user.id } })
        return { ledgerAccount, userId: profile.user.id }
    },
    capabilities: (data) => ({
        canDeposit: ledgerMovementAuth.createDeposit.data({ accounts: [data.ledgerAccount.ownership] }),
        // A payout is always a MANUAL payment, which only LEDGER_ADMIN may register.
        canPayout: Require.allOf(
            ledgerMovementAuth.createPayout.data({ accounts: [data.ledgerAccount.ownership] }),
            Require.permission('LEDGER_ADMIN'),
        ),
        canSeeFees: Require.permission('LEDGER_ADMIN'),
        // Unfreezing takes more than freezing, so the rule follows the state the button changes.
        canFreeze: data.ledgerAccount.frozen
            ? ledgerAccountAuth.updateAsAdmin({ accounts: [data.ledgerAccount.ownership] })
            : ledgerAccountAuth.update({ accounts: [data.ledgerAccount.ownership] }),
    }),
    render: ({ data, capabilities }) => (
        <div className="flex flex-col gap-2">
            <LedgerAccountOverview
                ledgerAccount={data.ledgerAccount}
                capabilities={capabilities}
                showFees={capabilities.canSeeFees.authorized}
            />
            <LedgerAccountPaymentMethods userId={data.userId} />
            <LedgerAccountTransactionSummary transactionsHref="account/transactions" />
        </div>
    ),
})

export default page
export { generateMetadata }
