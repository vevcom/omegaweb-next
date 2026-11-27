import { LedgerAccountGroupsCard } from '@/components/Ledger/Accounts/LedgerAccountGroupsCard'
import EditLedgerAccountDetailsForm from '@/components/Ledger/Accounts/EditLedgerAccountDetailsForm'
import PopUp from '@/components/PopUp/PopUp'
import LedgerAccountOverview from '@/components/Ledger/Accounts/LedgerAccountOverviewCard'
import {
    LedgerAccountTransactionSummary,
    transactionSummarySize,
} from '@/components/Ledger/Accounts/LedgerAccountTransactionSummaryCard'
import { readExpandedOfAllTypes } from '@/services/groups/readExpandedOfAllTypes'
import { flattenExpandedGroups } from '@/services/groups/flattenExpandedGroups'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { ledgerAccountAuth } from '@/services/ledger/accounts/auth'
import { ledgerMovementAuth } from '@/services/ledger/movements/auth'
import { ledgerTransactionOperations } from '@/services/ledger/transactions/operations'
import { paymentAuth } from '@/services/ledger/payments/auth'
import { Require } from '@/auth/authorizer/Require'
import { serverPage } from '@/app/ServerPage'
import { Suspendful } from '@/app/Suspendful'
import { appHref } from '@/lib/sites/href'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPencil } from '@fortawesome/free-solid-svg-icons'
import { notFound } from 'next/navigation'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params }: PageOperationArgs<{ accountId: string }>) => {
        const accountId = Number(params.accountId)

        if (!accountId) {
            notFound()
        }

        const ledgerAccount = await ledgerAccountOperations.read({ params: { ledgerAccountId: accountId } })
        const balance = await ledgerAccountOperations.calculateBalance({ params: { ledgerAccountId: accountId } })
        return { ledgerAccount, balance }
    },
    capabilities: ({ ledgerAccount }) => ({
        canUpdate: ledgerAccountAuth.update({ accounts: [ledgerAccount.ownership] }),
        canChangeGroups: ledgerAccountAuth.updateAsAdmin({ accounts: [ledgerAccount.ownership] }),
        // Only MANUAL deposits are offered here, and those take the payment rule on top.
        canDeposit: Require.allOf(
            ledgerMovementAuth.createDeposit.data({ accounts: [ledgerAccount.ownership] }),
            paymentAuth.create({ provider: 'MANUAL' }),
        ),
        // A payout is always a MANUAL payment, which paymentAuth.create reserves for
        // LEDGER_ADMIN - require it here too, or a non-admin owner would see the button and
        // then get rejected the moment they actually try to use it.
        canPayout: Require.allOf(
            ledgerMovementAuth.createPayout.data({ accounts: [ledgerAccount.ownership] }),
            paymentAuth.create({ provider: 'MANUAL' }),
        ),
        // Unfreezing takes more than freezing, so the rule follows the state the button changes.
        canFreeze: ledgerAccount.frozen
            ? ledgerAccountAuth.updateAsAdmin({ accounts: [ledgerAccount.ownership] })
            : ledgerAccountAuth.update({ accounts: [ledgerAccount.ownership] }),
    }),
    render: ({ data: { ledgerAccount, balance }, capabilities }) => (
        <div className="flex flex-col gap-2">
            {ledgerAccount.type === 'GROUP' && capabilities.canUpdate.authorized && (
                <PopUp
                    popUpKey="editLedgerAccountDetails"
                    showButtonClass="
                        self-end size-[20px] bg-base-100 border-none rounded-full cursor-pointer transition-[background]
                        duration-500 flex justify-center items-center text-base-content
                        hover:bg-base-200
                    "
                    showButtonContent={<FontAwesomeIcon icon={faPencil} className="text-base-content" />}
                >
                    <EditLedgerAccountDetailsForm
                        ledgerAccount={ledgerAccount}
                        popUpKey="editLedgerAccountDetails"
                    />
                </PopUp>
            )}
            {ledgerAccount.type === 'GROUP' && (
                <Suspendful
                    operation={async () => ({ allGroups: flattenExpandedGroups(await readExpandedOfAllTypes({})) })}
                    section={LedgerAccountGroupsCard}
                    props={{
                        ledgerAccountId: ledgerAccount.id,
                        groupIds: ledgerAccount.groupIds,
                        capabilities: { canChangeGroups: capabilities.canChangeGroups },
                    }}
                />
            )}
            <LedgerAccountOverview
                ledgerAccount={ledgerAccount}
                balance={balance}
                depositPaymentMethods={['MANUAL']}
                capabilities={capabilities}
                showFees
            />
            {/* Add link to products overview */}
            <Suspendful
                operation={async () => ({
                    transactions: await ledgerTransactionOperations.readPage({
                        params: {
                            paging: {
                                page: { page: 0, pageSize: transactionSummarySize, cursor: null },
                                details: { accountId: ledgerAccount.id },
                            },
                        },
                    }),
                })}
                section={LedgerAccountTransactionSummary}
                props={{
                    accountId: ledgerAccount.id,
                    transactionsHref: appHref(`/admin/accounts/${ledgerAccount.id}/transactions`),
                }}
            />
        </div>
    ),
})

export default page
export { generateMetadata }
