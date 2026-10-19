import styles from './page.module.scss'
import ResolveManualReviewForm from './ResolveManualReviewForm'
import { manualReviewOperations } from '@/services/ledger/transactions/manualReviews/operations'
import { authorizeAdminPage } from '@/app/admin/authorizeAdminPage'
import { displayAmount } from '@/lib/currency/convert'
import Date from '@/components/Date/Date'
import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        authorizeAdminPage('ledger-review', session)
        return manualReviewOperations.readOpen({})
    },
    metadata: () => ({ title: 'Trenger oppfølging' }),
    render: ({ data: transactions }) => (
        <div className={styles.wrapper}>
            <h1>Transaksjoner som trenger oppfølging</h1>
            <p>
                Transaksjoner med en åpen sak (f.eks. en Stripe-dispute, en refusjon gjort direkte
                hos Stripe, eller en automatisk tilbakebetaling som mislyktes). Disse må håndteres
                manuelt.
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
                            <th>Saker</th>
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
                                    <td>
                                        <ul className={styles.reviews}>
                                            {transaction.manualReviews.map(review => (
                                                <li key={review.id}>
                                                    <p>{review.problemDescription}</p>
                                                    {review.state === 'OPEN' ? (
                                                        <ResolveManualReviewForm reviewId={review.id} />
                                                    ) : (
                                                        <p className={styles.resolved}>
                                                            Løst: {review.resolutionDescription}
                                                        </p>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    </td>
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
