import LedgerAccountCard from './LedgerAccountCard'
import PaymentMethodList from '@/components/Ledger/Accounts/PaymentMethodList'
import PaymentMethodModal from '@/components/Ledger/Modals/PaymentMethodModal'
import DisconnectStudentCardButton from '@/components/Ledger/Accounts/DisconnectStudentCardButton'
import BooleanIndicator from '@/components/UI/BooleanIndicator'
import { componentWithSkeleton } from '@/app/componentWithSkeleton'
import type { FilteredPaymentMethod } from '@/services/stripeCustomers/types'

type Known = {
    userId: number,
}

type Read = {
    studentCard: string | null,
    savedPaymentMethods: FilteredPaymentMethod[],
}

/**
 * While it loads, the card is as it is for an owner with a student card and no saved bank card. A
 * block of a line and 2rem is a button, and the last one has the room a form keeps under its button.
 */
export const LedgerAccountPaymentMethods = componentWithSkeleton<Known, Read>(
    ({ userId, loaded, Skeleton, studentCard, savedPaymentMethods }) => (
        <LedgerAccountCard title="Betalingsalternativer">
            <div className="flex flex-col gap-2">
                <h3>Bankkort {loaded && <BooleanIndicator value={savedPaymentMethods.length > 0} />}</h3>
                <p>
                    Du kan lagre kortinformasjonen din for senere betalinger.
                    Kortinformasjonen lagres kun hos betalingsleverandøren vår, Stripe, og ikke på våre tjenere.
                </p>
                {loaded ? <>
                    <PaymentMethodList userId={userId} paymentMethods={savedPaymentMethods} />
                    <PaymentMethodModal userId={userId} />
                </> : <>
                    <Skeleton className="h-lh w-64 text-s" />
                    <Skeleton className="m-2 h-[calc(1lh+2rem)] w-40 text-m" />
                </>}
            </div>
            <div className="mt-6 flex flex-col gap-2">
                <h3>NTNU-kort {loaded && <BooleanIndicator value={studentCard !== null} />}</h3>
                <p>
                    For å benytte Kiogeskabet på Lophtet må et NTNU-kort være registrert.
                    Dette kan gjøres på Kiogeskabet på Lophtet.
                </p>
                {loaded ? <>
                    <p>Kortnummer: <strong>{studentCard ?? 'ikke registrert'}</strong></p>
                    {studentCard !== null && <DisconnectStudentCardButton userId={userId} />}
                </> : <>
                    <Skeleton className="h-lh w-64 text-m" />
                    <Skeleton className="mb-[calc(1.15em+3px)] h-[calc(1lh+2rem)] w-40 text-m" />
                </>}
            </div>
        </LedgerAccountCard>
    )
)
