import TransactionList from '@/components/Ledger/Transactions/LedgerTransactionList'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { ledgerTransactionAuth } from '@/services/ledger/transactions/auth'
import { capabilitiesToJsObject } from '@/auth/authorizer/capabilities'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { serverPage } from '@/app/ServerPage'
import { notFound } from 'next/navigation'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params, searchParams }: PageOperationArgs<{ accountId: string }>) => {
        const accountId = Number(params.accountId)

        if (!accountId) {
            notFound()
        }

        return {
            ledgerAccount: await ledgerAccountOperations.read({ params: { ledgerAccountId: accountId } }),
            filters: {
                search: QueryParams.search.decode(searchParams) ?? undefined,
                purpose: QueryParams.transactionPurpose.decode(searchParams) ?? undefined,
                direction: QueryParams.transactionDirection.decode(searchParams) ?? undefined,
                minAmount: QueryParams.minAmount.decode(searchParams) ?? undefined,
                maxAmount: QueryParams.maxAmount.decode(searchParams) ?? undefined,
            },
        }
    },
    capabilities: ({ ledgerAccount }) => ({
        // Every transaction listed involves this account, so owning it makes the viewer a party.
        canCancel: ledgerTransactionAuth.cancel.data({ accounts: [ledgerAccount.ownership] }),
    }),
    render: ({ data: { ledgerAccount, filters }, capabilities }) => (
        <div className="rounded-round p-(--card-padding)">
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
