import styles from './page.module.scss'
import LedgerAccountGroupsCard from '@/components/Ledger/Accounts/LedgerAccountGroupsCard'
import EditLedgerAccountDetailsForm from '@/components/Ledger/Accounts/EditLedgerAccountDetailsForm'
import PopUp from '@/components/PopUp/PopUp'
import { faPencil } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import LedgerAccountOverview from '@/components/Ledger/Accounts/LedgerAccountOverviewCard'
import LedgerAccountTransactionSummary from '@/components/Ledger/Accounts/LedgerAccountTransactionSummaryCard'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { serverPage } from '@/app/serverPage'
import { notFound } from 'next/navigation'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params }: PageOperationArgs<{ accountId: string }>) => {
        const accountId = Number(params.accountId)

        if (!accountId) {
            notFound()
        }

        return ledgerAccountOperations.read({ params: { ledgerAccountId: accountId } })
    },
    render: ({ data: ledgerAccount }) => (
        <div className={styles.wrapper}>
            {ledgerAccount.type === 'GROUP' && (
                <PopUp
                    popUpKey="editLedgerAccountDetails"
                    showButtonClass={styles.editButton}
                    showButtonContent={<FontAwesomeIcon icon={faPencil} />}
                >
                    <EditLedgerAccountDetailsForm ledgerAccount={ledgerAccount} popUpKey="editLedgerAccountDetails" />
                </PopUp>
            )}
            {ledgerAccount.type === 'GROUP' && (
                <LedgerAccountGroupsCard ledgerAccountId={ledgerAccount.id} groupIds={ledgerAccount.groupIds} />
            )}
            <LedgerAccountOverview
                ledgerAccount={ledgerAccount}
                showDepositButton
                depositPaymentMethods={['MANUAL']}
                showPayoutButton
                showDeactivateButton
                showFees
            />
            {/* Add link to products overview */}
            <LedgerAccountTransactionSummary transactionsHref={`${ledgerAccount.id}/transactions`} />
        </div>
    ),
})

export default page
export { generateMetadata }
