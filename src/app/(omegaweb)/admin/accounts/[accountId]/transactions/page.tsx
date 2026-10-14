import styles from './page.module.scss'
import TransactionList from '@/components/Ledger/Transactions/LedgerTransactionList'
import { notFound } from 'next/navigation'

type Props = {
    params: Promise<{
        accountId: string,
    }>,
}

export default async function LedgerAccountTransactions({ params }: Props) {
    const accountId = Number((await params).accountId)

    if (!accountId) {
        notFound()
    }

    return <div className={styles.wrapper}>
        <TransactionList accountId={accountId} />
    </div>
}
