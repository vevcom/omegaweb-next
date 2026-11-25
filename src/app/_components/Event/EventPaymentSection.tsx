import EventInfoRow from './EventInfoRow'
import { EventSubSection } from './EventSection'
import CountDown from '@/components/CountDown/CountDown'
import DateDisplay from '@/components/Date/Date'
import EventPaymentModal from '@/components/Ledger/Modals/EventPaymentModal'
import { displayAmount } from '@/lib/currency/convert'
import { paymentStatus } from '@/services/events/registration/paymentStatus'
import { requeueNotice } from '@/services/events/registration/requeueNotice'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleCheck, faCircleExclamation } from '@fortawesome/free-solid-svg-icons'
import type { RequeueNotice } from '@/services/events/registration/requeueNotice'
import type { Capabilities } from '@/auth/authorizer/capabilities'
import type { EventVariantSummary } from '@/services/events/types'
import type { EventRegistrationOfUser } from '@/services/events/registration/types'

const requeueNoticeText = {
    BEFORE_DEADLINE: 'Er plassen ikke betalt innen fristen, kan du bli flyttet bakerst på ventelisten.',
    AFTER_DEADLINE: 'Plassen er ikke betalt. Står noen på ventelisten, kan du bli flyttet bakerst på den.',
} satisfies Record<RequeueNotice, string>

export default function EventPaymentSection({
    eventId,
    eventStart,
    variant,
    registration,
    userId,
    availableBalance,
    customerSessionClientSecret,
    capabilities,
}: {
    eventId: number,
    eventStart: Date,
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
    const deadline = registration?.paymentDeadline ?? paymentEnd
    const paymentOpen = paymentStart <= now && now <= deadline
    const status = paymentStatus(registration)
    const notice = requeueNotice({
        requeueUnpaidRegistrations: variant.requeueUnpaidRegistrations,
        status,
        deadline,
        paymentEnd,
        eventStart,
        registeredAt: registration?.createdAt ?? null,
        now,
    })

    return <EventSubSection title="Betaling">
        <EventInfoRow label="Pris">{displayAmount(price, false)}</EventInfoRow>
        <EventInfoRow label="Betalingsstart"><DateDisplay date={paymentStart} includeSeconds={false} /></EventInfoRow>
        <EventInfoRow label="Betalingsslutt"><DateDisplay date={deadline} includeSeconds={false} /></EventInfoRow>

        {status === 'PAID' && (
            <p className="
                m-0 flex items-center gap-2 text-l font-bold text-success
                [&>svg]:size-5
            ">
                <FontAwesomeIcon icon={faCircleCheck} />
                Betalt
            </p>
        )}
        {status === 'UNPAID' && <>
            <p className="
                m-0 flex items-center gap-2 text-l font-bold text-warning
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
            {paymentStart > now && (
                <p className="m-0 text-base-content/80">Betaling åpner om <CountDown referenceDate={paymentStart} /></p>
            )}
            {deadline < now && (
                <p className="m-0 text-base-content/80">Betalingsperioden er over. Ta kontakt med arrangørene.</p>
            )}
        </>}
        {status === 'WAITING_LIST' && (
            <p className="m-0 text-base-content/80">Du står på ventelisten og betaler når du får plass.</p>
        )}
        {status === 'NOT_REGISTERED' && (
            <p className="m-0 text-base-content/80">Betales etter påmelding.</p>
        )}
        {notice && <p className="m-0 text-base-content/80">{requeueNoticeText[notice]}</p>}
    </EventSubSection>
}
