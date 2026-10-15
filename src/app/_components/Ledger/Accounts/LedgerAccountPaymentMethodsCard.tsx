import PaymentMethodList from '@/components/Ledger/Accounts/PaymentMethodList'
import PaymentMethodModal from '@/components/Ledger/Modals/PaymentMethodModal'
import { userOperations } from '@/services/users/operations'
import BooleanIndicator from '@/components/UI/BooleanIndicator'
import { stripeCustomerOperations } from '@/services/stripeCustomers/operations'
import { withFallback, withPageSession } from '@/app/ServerPage'
import Link from 'next/link'
import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

type Props = {
    userId: number,
}

export default async function LedgerAccountPaymentMethods({ userId }: Props) {
    const { user, savedPaymentMethods } = await withPageSession(async () => ({
        user: await userOperations.read({ params: { id: userId } }), // TODO: Change to better method
        savedPaymentMethods: await withFallback(
            stripeCustomerOperations.readSavedPaymentMethods({ params: { userId } }),
            []
        ),
    }))

    const hasBankCard = savedPaymentMethods.length > 0
    const hasStudentCard = user.studentCard !== null

    return <div className="bg-surface-base rounded-round p-[calc(3*var(--rounding))]">
        <h2>Betalingsalternativer</h2>
        <div className="flex flex-col gap-2">
            <h3>Bankkort <BooleanIndicator value={hasBankCard} /></h3>
            <p>
                Du kan lagre kortinformasjonen din for senere betalinger.
                Kortinformasjonen lagres kun hos betalingsleverandøren vår, Stripe, og ikke på våre tjenere.
            </p>
            <PaymentMethodList userId={userId} paymentMethods={savedPaymentMethods} />
            <PaymentMethodModal userId={userId} />
        </div>
        <div className="flex flex-col gap-2 mt-6">
            <h3>NTNU-kort <BooleanIndicator value={hasStudentCard} /></h3>
            <p>For å benytte Kiogeskabet på Lophtet må et NTNU-kort være registrert.</p>
            <p>Kortnummer: <strong>{hasStudentCard ? user.studentCard : 'ikke registrert'}</strong></p>
            <Link href={`/users/${user.username}/settings`} className="inline-flex items-center gap-2 w-fit">
                Gå til siden for kortregistrering <FontAwesomeIcon icon={faArrowRight} />
            </Link>
        </div>
    </div>
}
