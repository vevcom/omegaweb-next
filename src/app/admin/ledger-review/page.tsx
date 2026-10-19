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
    render: ({ data: reviews }) => (
        <div className={styles.wrapper}>
            <h1>Saker som trenger oppfølging</h1>
            <p>
                Åpne saker om en transaksjon eller betaling (f.eks. en Stripe-dispute, en refusjon gjort
                direkte hos Stripe, en automatisk tilbakebetaling som mislyktes, eller en feil funnet av
                den automatiske gjennomgangen av hovedboken). Disse må håndteres manuelt.
            </p>
            {reviews.length === 0 ? <p>Ingen saker trenger oppfølging akkurat nå.</p> : (
                <table className={styles.reviews}>
                    <thead>
                        <tr>
                            <th>Dato</th>
                            <th>Problem</th>
                            <th>Transaksjon</th>
                            <th>Betaling</th>
                            <th>Beløp</th>
                            <th>Løsning</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reviews.map(({ transaction, payment, ...review }) => {
                            const amount = payment?.funds ?? transaction?.ledgerEntries
                                .filter(entry => entry.funds > 0)
                                .reduce((sum, entry) => sum + entry.funds, 0) ?? 0
                            // A review about a payment alone lists the transactions the payment was for.
                            const transactions = transaction
                                ? `${transaction.id} (${transaction.purpose}, ${transaction.state})`
                                : payment?.ledgerTransactions.map(({ id }) => id).join(', ')

                            return (
                                <tr key={review.id}>
                                    <td><Date date={review.createdAt} /></td>
                                    <td>{review.problemDescription}</td>
                                    <td>{transactions || '-'}</td>
                                    <td>{payment ? `${payment.id} (${payment.provider}, ${payment.state})` : '-'}</td>
                                    <td>{displayAmount(amount, false)}</td>
                                    <td><ResolveManualReviewForm reviewId={review.id} /></td>
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
