import styles from './page.module.scss'
import LedgerAccountGroupsCard from '@/components/Ledger/Accounts/LedgerAccountGroupsCard'
import EditLedgerAccountDetailsForm from '@/components/Ledger/Accounts/EditLedgerAccountDetailsForm'
import PopUp from '@/components/PopUp/PopUp'
import { faPencil } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import LedgerAccountOverview from '@/components/Ledger/Accounts/LedgerAccountOverviewCard'
import LedgerAccountTransactionSummary from '@/components/Ledger/Accounts/LedgerAccountTransactionSummaryCard'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { ledgerAccountAuth } from '@/services/ledger/accounts/auth'
import { ledgerMovementAuth } from '@/services/ledger/movements/auth'
import { paymentAuth } from '@/services/ledger/payments/auth'
import { Require } from '@/auth/authorizer/Require'
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
        canUpdate: ledgerAccountAuth.update({ accounts: [ledgerAccount.ownership] }),
        canChangeGroups: ledgerAccountAuth.updateAsAdmin({ accounts: [ledgerAccount.ownership] }),
        // Only MANUAL deposits are offered here, and those take the payment rule on top.
        canDeposit: Require.allOf(
            ledgerMovementAuth.createDeposit.data({ accounts: [ledgerAccount.ownership] }),
            paymentAuth.create({ provider: 'MANUAL' }),
        ),
        canPayout: ledgerMovementAuth.createPayout,
        // Unfreezing takes more than freezing, so the rule follows the state the button changes.
        canFreeze: ledgerAccount.frozen
            ? ledgerAccountAuth.updateAsAdmin({ accounts: [ledgerAccount.ownership] })
            : ledgerAccountAuth.update({ accounts: [ledgerAccount.ownership] }),
    }),
    render: ({ data: ledgerAccount, capabilities }) => (
        <div className={styles.wrapper}>
            {ledgerAccount.type === 'GROUP' && capabilities.canUpdate.authorized && (
                <PopUp
                    popUpKey="editLedgerAccountDetails"
                    showButtonClass={styles.editButton}
                    showButtonContent={<FontAwesomeIcon icon={faPencil} />}
                >
                    <EditLedgerAccountDetailsForm
                        ledgerAccount={ledgerAccount}
                        popUpKey="editLedgerAccountDetails"
                    />
                </PopUp>
            )}
            {ledgerAccount.type === 'GROUP' && (
                <LedgerAccountGroupsCard
                    ledgerAccountId={ledgerAccount.id}
                    groupIds={ledgerAccount.groupIds}
                    capabilities={{ canChangeGroups: capabilities.canChangeGroups }}
                />
            )}
            <LedgerAccountOverview
                ledgerAccount={ledgerAccount}
                depositPaymentMethods={['MANUAL']}
                capabilities={capabilities}
                showFees
            />
            {/* Add link to products overview */}
            <LedgerAccountTransactionSummary transactionsHref={`${ledgerAccount.id}/transactions`} />
        </div>
    ),
})

export default page
export { generateMetadata }
