import EventSidebarSection from './EventSidebarSection'
import EventInfoRow from './EventInfoRow'
import CountDown from '@/components/CountDown/CountDown'
import DateDisplay from '@/components/Date/Date'
import EventPaymentModal from '@/components/Ledger/Modals/EventPaymentModal'
import { displayAmount } from '@/lib/currency/convert'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleCheck, faCircleExclamation } from '@fortawesome/free-solid-svg-icons'
import type { Capabilities } from '@/auth/authorizer/capabilities'
import type { EventExpanded } from '@/services/events/types'
import type { EventRegistrationOfUser } from '@/services/events/registration/types'

/** Where the visitor stands with paying for the event. Only a registration holding a place is paid for. */
function paymentStatus(registration: EventRegistrationOfUser | null) {
    if (!registration) return 'NOT_REGISTERED'
    if (registration.state === 'WAITING_LIST') return 'WAITING_LIST'
    if (registration.ledgerTransactions.length > 0 || registration.manuallyPaid) return 'PAID'
    return 'UNPAID'
}

/** The price of the visitor's quota, or the range over the quotas for someone without a place. */
function priceText(event: EventExpanded, registration: EventRegistrationOfUser | null) {
    if (registration?.quota?.price) return displayAmount(registration.quota.price, false)
    const prices = event.quotas.flatMap(quota => (quota.price === null ? [] : [quota.price]))
    if (prices.length === 0) return null
    const lowest = Math.min(...prices)
    const highest = Math.max(...prices)
    return lowest === highest
        ? displayAmount(lowest, false)
        : `${displayAmount(lowest, false)} – ${displayAmount(highest, false)}`
}

/**
 * The payment section of the sidebar of a paid event: the price, the payment period and whether the
 * visitor has paid, with the way to pay while the period is open.
 */
export default function EventPaymentSection({
    event,
    registration,
    userId,
    availableBalance,
    customerSessionClientSecret,
    capabilities,
}: {
    event: EventExpanded,
    /** The visitor's registration, with whether a payment is in effect for it. */
    registration: EventRegistrationOfUser | null,
    userId: number | null,
    availableBalance?: number,
    customerSessionClientSecret?: string,
    capabilities: Capabilities<'canPay'>,
}) {
    const { paymentStart, paymentEnd } = event
    const price = priceText(event, registration)
    if (!event.takesPayment || price === null || !paymentStart || !paymentEnd) return null

    const now = new Date()
    const paymentOpen = paymentStart <= now && now <= paymentEnd
    const status = paymentStatus(registration)
    const ownPrice = registration?.quota?.price ?? null

    return <EventSidebarSection title="Betaling">
        <EventInfoRow label="Pris">{price}</EventInfoRow>
        <EventInfoRow label="Betalingsstart"><DateDisplay date={paymentStart} includeTime /></EventInfoRow>
        <EventInfoRow label="Betalingsslutt"><DateDisplay date={paymentEnd} includeTime /></EventInfoRow>

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
            {paymentOpen && userId !== null && ownPrice !== null && capabilities.canPay.authorized && (
                <EventPaymentModal
                    eventId={event.id}
                    userId={userId}
                    price={ownPrice}
                    availableBalance={availableBalance}
                    customerSessionClientSecret={customerSessionClientSecret}
                    triggerLabel="Betal nå"
                />
            )}
            {paymentStart > now && (
                <p className="m-0 text-text-muted">Betaling åpner om <CountDown referenceDate={paymentStart} /></p>
            )}
            {paymentEnd < now && (
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
