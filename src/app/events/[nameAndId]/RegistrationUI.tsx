'use client'
import styles from './RegistrationUI.module.scss'
import CountDown from '@/components/countDown/CountDown'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import SubmitButton from '@/components/UI/SubmitButton'
import EventPaymentModal from '@/components/Ledger/Modals/EventPaymentModal'
import {
    createEventRegistrationAction,
    destroyEventRegistrationAction,
    updateEventRegistrationNotesAction
} from '@/services/events/registration/actions'
import { configureAction } from '@/services/configureAction'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import type { EventExpanded } from '@/services/events/types'
import type { DotPunishment, EventRegistrationWithWaitingList } from '@/services/events/registration/types'
import type { CapabilitiesJsObject } from '@/auth/authorizer/capabilities'

enum RegistrationButtonState {
    NOT_REGISTERED = 'NOT_REGISTERED',
    REGISTERED = 'REGISTERED',
    FULL = 'FULL',
    ON_WAITING_LIST = 'ON_WAITING_LIST',
    WAITING_LIST_OPEN = 'WAITING_LIST_OPEN',
    REGISTRATION_NOT_OPEN = 'REGISTRATION_NOT_OPEN',
    REGISTRATION_CLOSED = 'REGISTRATION_CLOSED',
    BANNED_BY_DOTS = 'BANNED_BY_DOTS',
    NOT_ALLOWED = 'NOT_ALLOWED',
    ERROR = 'ERROR',
}

export default function RegistrationUI({
    event,
    registration,
    dotPunishment,
    availableBalance,
    customerSessionClientSecret,
    capabilities,
}: {
    event: EventExpanded,
    registration: (EventRegistrationWithWaitingList & { ledgerTransactions: { id: number }[] }) | null,
    dotPunishment: DotPunishment | null,
    availableBalance?: number,
    customerSessionClientSecret?: string,
    capabilities: CapabilitiesJsObject<'canRegister'>,
}) {
    if (!event.takesRegistration) {
        throw new Error('Kan bare vise påmeldingsknapp for arrangement som har påmelding')
    }

    // Dots hold the user back past the registration start of the event, so it is the delayed start
    // that decides when the button opens - the event opens at event.registrationStart for the rest.
    const registrationStart = dotPunishment?.type === 'timeout' ?
        new Date(event.registrationStart.getTime() + dotPunishment.punishmentMinutes * 60 * 1000) :
        event.registrationStart

    const getInitialBtnState = (ownRegistration: EventRegistrationWithWaitingList | null) => {
        if (ownRegistration) {
            return ownRegistration.onWaitingList ?
                RegistrationButtonState.ON_WAITING_LIST :
                RegistrationButtonState.REGISTERED
        }
        if (dotPunishment?.type === 'ban') {
            return RegistrationButtonState.BANNED_BY_DOTS
        }
        // The regular visibility level of the event decides who may register for it at all.
        if (!capabilities.canRegister.authorized) {
            return RegistrationButtonState.NOT_ALLOWED
        }
        if (registrationStart > new Date()) {
            return RegistrationButtonState.REGISTRATION_NOT_OPEN
        }
        if (event.numOfRegistrations >= event.places) {
            if (event.waitingList) {
                return RegistrationButtonState.WAITING_LIST_OPEN
            }
            return RegistrationButtonState.FULL
        }
        if (event.registrationEnd < new Date()) {
            return RegistrationButtonState.REGISTRATION_CLOSED
        }
        return RegistrationButtonState.NOT_REGISTERED
    }

    const [errorText, setErrorText] = useState('')
    const [registrationState, setRegistrationState] = useState<EventRegistrationWithWaitingList | null>(registration)

    const [btnState, setBtnState] = useState(getInitialBtnState(registration))
    const [btnPending, setBtnPending] = useState(false)
    const [btnKey, setBtnKey] = useState(1)

    const session = useSession()

    useEffect(() => {
        const timeUntilRegistration = registrationStart.getTime() - (new Date()).getTime()
        let timeoutId: ReturnType<typeof setTimeout>
        if (timeUntilRegistration > 0) {
            timeoutId = setTimeout(() => {
                setBtnState(getInitialBtnState(registrationState))
            }, timeUntilRegistration)
        }

        return () => {
            if (timeoutId) {
                clearTimeout(timeoutId)
            }
        }
    })

    if (!session.data) {
        return <>Logg inn for å melde deg på</>
    }

    const buttonOnClick = async () => {
        setBtnPending(true)

        if (registrationState) {
            const result = await destroyEventRegistrationAction({
                params: { registrationId: registrationState.id },
            })
            if (result.success) {
                setBtnState(getInitialBtnState(null))
                setRegistrationState(null)
            } else if (result.error && result.error.length > 0) {
                const message = result.error[0].message
                setErrorText(message)
                setBtnState(RegistrationButtonState.ERROR)
            } else {
                setErrorText('Kunne ikke melde deg av påmelding.')
                setBtnState(RegistrationButtonState.ERROR)
            }
        } else {
            const result = await createEventRegistrationAction({
                params: {
                    userId: session.data.user.id,
                    eventId: event.id,
                }
            })

            if (result.success) {
                setBtnState(getInitialBtnState(result.data))
                setRegistrationState(result.data)
            } else if (result.error && result.error.length > 0) {
                const message = result.error[0].message
                setErrorText(message)
                setBtnState(RegistrationButtonState.ERROR)
            } else {
                setErrorText('Kunne ikke melde deg på.')
                setBtnState(RegistrationButtonState.ERROR)
            }
        }

        setBtnPending(false)
        setBtnKey(btnKey + 1)
    }

    // Payment only applies once registration is confirmed, not while waitlisted.
    const now = new Date()
    const paymentOpen = Boolean(event.price && event.paymentStart && event.paymentEnd) &&
        event.paymentStart! <= now && now <= event.paymentEnd!
    const paymentNotYetOpen = Boolean(event.price && event.paymentStart) && event.paymentStart! > now
    const paymentClosed = Boolean(event.price && event.paymentEnd) && event.paymentEnd! < now
    // registration (not registrationState) is used here since it reflects payment status as of
    // the last full page load - any payment action refreshes the page (see refreshOnSuccess on
    // EventPaymentModal), which re-fetches this from the server.
    const alreadyPaid = Boolean(registration?.ledgerTransactions.length)
    const showPayment = Boolean(event.price) && btnState === RegistrationButtonState.REGISTERED && !alreadyPaid

    return <>
        <SubmitButton
            success={false}
            confirmation={
                btnState === RegistrationButtonState.REGISTERED ||
                    btnState === RegistrationButtonState.ON_WAITING_LIST
                    ? {
                        confirm: true,
                        text: 'Er du sikker på at du vil melde deg av?'
                    }
                    : undefined
            }
            disabled={
                btnState !== RegistrationButtonState.NOT_REGISTERED &&
                btnState !== RegistrationButtonState.WAITING_LIST_OPEN &&
                btnState !== RegistrationButtonState.REGISTERED &&
                btnState !== RegistrationButtonState.ON_WAITING_LIST
            }
            color={
                btnState === RegistrationButtonState.REGISTERED ||
                    btnState === RegistrationButtonState.ON_WAITING_LIST
                    ? 'red'
                    : 'primary'
            }
            className={styles.registrationButton}
            onClick={buttonOnClick}
            pending={btnPending}
            key={btnKey}
        >
            {(
                btnState === RegistrationButtonState.NOT_REGISTERED ||
                btnState === RegistrationButtonState.REGISTRATION_NOT_OPEN
            ) && 'Meld meg på'}
            {btnState === RegistrationButtonState.REGISTERED && 'Meld av arrangement'}
            {btnState === RegistrationButtonState.ON_WAITING_LIST && 'Meld av venteliste'}
            {btnState === RegistrationButtonState.FULL && 'Fullt'}
            {btnState === RegistrationButtonState.WAITING_LIST_OPEN && 'Meld meg på venteliste'}
            {btnState === RegistrationButtonState.ERROR && errorText}
            {btnState === RegistrationButtonState.REGISTRATION_CLOSED && 'Påmeldingen er over'}
            {btnState === RegistrationButtonState.BANNED_BY_DOTS && 'Utestengt av prikker'}
            {btnState === RegistrationButtonState.NOT_ALLOWED && 'Du kan ikke melde deg på dette arrangementet'}
        </SubmitButton>

        {btnState === RegistrationButtonState.REGISTRATION_NOT_OPEN && (
            <p>Påmeldingen åpner om <CountDown referenceDate={registrationStart} /></p>
        )}

        {showPayment && event.price && paymentOpen && (
            <EventPaymentModal
                eventId={event.id}
                userId={session.data.user.id}
                price={event.price}
                availableBalance={availableBalance}
                customerSessionClientSecret={customerSessionClientSecret}
                triggerLabel="Betal for arrangementet"
            />
        )}
        {showPayment && paymentNotYetOpen && (
            <p>Betaling åpner om <CountDown referenceDate={event.paymentStart!} /></p>
        )}
        {showPayment && paymentClosed && (
            <p>Betalingsperioden er over.</p>
        )}

        {dotPunishment?.type === 'ban' && (
            <p>Du har for mange prikker, og kan derfor ikke melde deg på arrangementer.</p>
        )}

        {dotPunishment?.type === 'timeout' && (
            <p>
                Du har prikker, og må derfor vente {dotPunishment.punishmentMinutes} minutter
                etter ordinær påmeldingsstart med å melde deg på.
            </p>
        )}

        {registrationState && event.registrationEnd > new Date() && <Form
            action={configureAction(
                updateEventRegistrationNotesAction,
                { params: { registrationId: registrationState.id } }
            )}
            submitText="Oppdater notat"
        >
            <TextInput name="note" label="Notat" defaultValue={registrationState.note || ''} />
        </Form>}

    </>
}
