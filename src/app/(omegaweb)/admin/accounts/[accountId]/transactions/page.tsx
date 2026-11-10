import TransactionList from '@/components/Ledger/Transactions/LedgerTransactionList'
import { serverPage } from '@/app/ServerPage'
import { notFound } from 'next/navigation'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page } = serverPage({
    operation: ({ params }: PageOperationArgs<{ accountId: string }>) => {
        const accountId = Number(params.accountId)
        if (!accountId) notFound()
        return { accountId }
    },
    render: ({ data }) => <div className="rounded-round p-(--card-padding)">
        <TransactionList accountId={data.accountId} />
    </div>,
})

export default page
