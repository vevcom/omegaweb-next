import EventSidebarSection from './EventSidebarSection'
import EventInfoRow from './EventInfoRow'
import CountDown from '@/components/CountDown/CountDown'
import DateDisplay from '@/components/Date/Date'
import EventPaymentModal from '@/components/Ledger/Modals/EventPaymentModal'
import { displayAmount } from '@/lib/currency/convert'
import { paymentDeadline } from '@/services/events/registration/paymentDeadline'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleCheck, faCircleExclamation } from '@fortawesome/free-solid-svg-icons'
import type { Capabilities } from '@/auth/authorizer/capabilities'
import type { EventVariantSummary } from '@/services/events/types'
import type { EventRegistrationOfUser } from '@/services/events/registration/types'

/** Where the visitor stands with paying for the variant. Only a registration holding a place is paid for. */
function paymentStatus(registration: EventRegistrationOfUser | null) {
    if (!registration) return 'NOT_REGISTERED'
    if (registration.state === 'WAITING_LIST') return 'WAITING_LIST'
    if (registration.ledgerTransactions.length > 0 || registration.manuallyPaid) return 'PAID'
    return 'UNPAID'
}

export default function EventPaymentSection({
    eventId,
    variant,
    registration,
    userId,
    availableBalance,
    customerSessionClientSecret,
    capabilities,
}: {
    eventId: number,
    variant: EventVariantSummary,
    /** The visitor's registration in the variant, with whether a payment is in effect for it. */
    registration: EventRegistrationOfUser | null,
    userId: number | null,
    availableBalance?: number,
    customerSessionClientSecret?: string,
    capabilities: Capabilities<'canPay'>,
}) {
    const { price, paymentStart, paymentEnd } = variant
    if (!variant.takesPayment || price === null || !paymentStart || !paymentEnd) return null

    const now = new Date()
    const deadline = paymentDeadline(paymentEnd, registration?.promotedAt ?? null)
    const paymentOpen = paymentStart <= now && now <= deadline
    const status = paymentStatus(registration)

    return <EventSidebarSection title="Betaling">
        <EventInfoRow label="Pris">{displayAmount(price, false)}</EventInfoRow>
        <EventInfoRow label="Betalingsstart"><DateDisplay date={paymentStart} includeTime /></EventInfoRow>
        <EventInfoRow label="Betalingsslutt"><DateDisplay date={deadline} includeTime /></EventInfoRow>

        {status === 'PAID' && (
            <p className="
                m-0 flex items-center gap-2 text-l font-bold text-accent-green
                [&>svg]:size-5
            ">
                <FontAwesomeIcon icon={faCircleCheck} />
                Betalt
            </p>
        )}
        {status === 'UNPAID' && <>
            <p className="
                m-0 flex items-center gap-2 text-l font-bold text-accent-orange
                [&>svg]:size-5
            ">
                <FontAwesomeIcon icon={faCircleExclamation} />
                Ikke betalt
            </p>
            {paymentOpen && userId !== null && capabilities.canPay.authorized && (
                <EventPaymentModal
                    eventId={eventId}
                    variantId={variant.id}
                    userId={userId}
                    price={price}
                    availableBalance={availableBalance}
                    customerSessionClientSecret={customerSessionClientSecret}
                    triggerLabel="Betal nå"
                />
            )}
            {variant.requeueUnpaidRegistrations && deadline >= now && (
                <p className="m-0 text-text-muted">Betaler du ikke innen fristen, flyttes du bakerst på ventelisten.</p>
            )}
            {paymentStart > now && (
                <p className="m-0 text-text-muted">Betaling åpner om <CountDown referenceDate={paymentStart} /></p>
            )}
            {deadline < now && (
                <p className="m-0 text-text-muted">Betalingsperioden er over. Ta kontakt med arrangørene.</p>
            )}
        </>}
        {status === 'WAITING_LIST' && (
            <p className="m-0 text-text-muted">Du står på ventelisten og betaler når du får plass.</p>
        )}
        {status === 'NOT_REGISTERED' && (
            <p className="m-0 text-text-muted">Betales etter påmelding.</p>
        )}
    </EventSidebarSection>
}
