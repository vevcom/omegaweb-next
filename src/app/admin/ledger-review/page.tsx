import styles from './page.module.scss'
import { ledgerTransactionOperations } from '@/services/ledger/transactions/operations'
import { authorizeAdminPage } from '@/app/admin/authorizeAdminPage'
import { displayAmount } from '@/lib/currency/convert'
import Date from '@/components/Date/Date'
import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        authorizeAdminPage('ledger-review', session)
        return ledgerTransactionOperations.readNeedingAttention({})
    },
    metadata: () => ({ title: 'Trenger oppfølging' }),
    render: ({ data: transactions }) => (
        <div className={styles.wrapper}>
            <h1>Transaksjoner som trenger oppfølging</h1>
            <p>
                Transaksjoner som er eksplisitt flagget (f.eks. en Stripe-dispute eller en refusjon gjort
                direkte hos Stripe), eller som endte MISLYKTET lokalt selv om Stripe-betalingen gikk gjennom.
                Disse må håndteres manuelt.
            </p>
            {transactions.length === 0 ? <p>Ingen transaksjoner trenger oppfølging akkurat nå.</p> : (
                <table className={styles.transactions}>
                    <thead>
                        <tr>
                            <th>id</th>
                            <th>Dato</th>
                            <th>Formål</th>
                            <th>Status</th>
                            <th>Beløp</th>
                            <th>Merknad</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transactions.map(transaction => {
                            const amount = transaction.ledgerEntries
                                .filter(entry => entry.funds > 0)
                                .reduce((sum, entry) => sum + entry.funds, 0)

                            return (
                                <tr key={transaction.id}>
                                    <td>{transaction.id}</td>
                                    <td><Date date={transaction.createdAt} /></td>
                                    <td>{transaction.purpose}</td>
                                    <td>{transaction.state}</td>
                                    <td>{displayAmount(amount, false)}</td>
                                    <td>{transaction.needsManualReview ?? transaction.reason}</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            )}
        </div>
    ),
})

export default page
export { generateMetadata }
