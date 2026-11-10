import TransactionList from '@/components/Ledger/Transactions/LedgerTransactionList'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { ledgerTransactionAuth } from '@/services/ledger/transactions/auth'
import { capabilitiesToJsObject } from '@/auth/authorizer/capabilities'
import { Require } from '@/auth/authorizer/Require'
import { decodeLedgerTransactionFilters } from '@/components/Ledger/Transactions/decodeLedgerTransactionFilters'
import { getProfileForUserPage } from '@/app/(omegaweb)/users/[username]/(user-pages)/getProfileForUserPage'
import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params, searchParams, session }: PageOperationArgs<{ username: string }>) => {
        const { profile } = await getProfileForUserPage(params, 'account', session)

        return {
            ledgerAccount: await ledgerAccountOperations.read({ params: { userId: profile.user.id } }),
            filters: decodeLedgerTransactionFilters(searchParams),
        }
    },
    capabilities: ({ ledgerAccount }) => ({
        // Every transaction listed involves this account, so owning it makes the viewer a party.
        canCancel: ledgerTransactionAuth.cancel.data({ accounts: [ledgerAccount.ownership] }),
        // The page is open to the account's owners too, so the fees need a rule of their own.
        canSeeFees: Require.permission('LEDGER_ADMIN'),
    }),
    render: ({ data: { ledgerAccount, filters }, capabilities }) => (
        <div className="bg-base-100 rounded-round p-(--card-padding) overflow-x-auto">
            <TransactionList
                accountId={ledgerAccount.id}
                filters={filters}
                capabilities={capabilitiesToJsObject(capabilities)}
            />
        </div>
    ),
})

export default page
export { generateMetadata }
