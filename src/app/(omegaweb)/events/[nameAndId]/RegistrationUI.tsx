'use client'
import CountDown from '@/components/CountDown/CountDown'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import SubmitButton from '@/components/UI/SubmitButton'
import EventPaymentModal from '@/components/Ledger/Modals/EventPaymentModal'
import {
    createEventRegistrationAction,
    createEventRegistrationAsAdminAction,
    destroyEventRegistrationAction,
    updateEventRegistrationNotesAction
} from '@/services/events/registration/actions'
import { configureAction } from '@/services/configureAction'
import { eventRegistrationAuth } from '@/services/events/registration/auth'
import { Require } from '@/auth/authorizer/Require'
import useAuthorizer from '@/hooks/useAuthorizer'
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
    ERROR = 'ERROR'
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
    capabilities: CapabilitiesJsObject<'canRegister' | 'canRegisterAsAdmin'>,
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
            if (event.binding) {
                return ownRegistration.onWaitingList ?
                    RegistrationButtonState.ON_WAITING_LIST :
                    RegistrationButtonState.BINDING
            }
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
    const canPay = useAuthorizer({
        authorizer: session.data
            ? eventRegistrationAuth.createPayment.data({ userId: session.data.user.id })
            : Require.user(),
    }).authorized

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

    const userId = session.data.user.id

    const register = async (
        // Separate implementations of one sub-operation, which may diverge.
        // eslint-disable-next-line @typescript-eslint/no-duplicate-type-constituents
        createAction: typeof createEventRegistrationAction | typeof createEventRegistrationAsAdminAction
    ) => {
        const result = await createAction({
            params: {
                userId,
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
                setErrorText('Kunne ikke melde deg av.')
                setBtnState(RegistrationButtonState.ERROR)
            }
        } else {
            await register(createEventRegistrationAction)
        }

        setBtnPending(false)
        setBtnKey(btnKey + 1)
    }

    // Administrators of the event register outside the registration period and past their own dots
    // - through a button of its own, so that it is clear it is not an ordinary registration.
    const adminButtonOnClick = async () => {
        setBtnPending(true)
        await register(createEventRegistrationAsAdminAction)
        setBtnPending(false)
        setBtnKey(btnKey + 1)
    }

    // Payment only applies once registration is confirmed, not while waitlisted.
    const now = new Date()
    const paymentOpen = event.takesPayment && Boolean(event.paymentStart && event.paymentEnd) &&
        event.paymentStart! <= now && now <= event.paymentEnd!
    const paymentNotYetOpen = event.takesPayment && Boolean(event.paymentStart) && event.paymentStart! > now
    const paymentClosed = event.takesPayment && Boolean(event.paymentEnd) && event.paymentEnd! < now
    // registration (not registrationState) is used here since it reflects payment status as of
    // the last full page load - any payment action refreshes the page (see refreshOnSuccess on
    // EventPaymentModal), which re-fetches this from the server.
    const alreadyPaid = Boolean(registration?.ledgerTransactions.length) || Boolean(registration?.manuallyPaid)
    const showPayment = event.takesPayment && btnState === RegistrationButtonState.REGISTERED && !alreadyPaid

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
            className="w-full! m-0!"
            onClick={buttonOnClick}
            pending={btnPending}
            key={btnKey}
        >
            {(
                btnState === RegistrationButtonState.NOT_REGISTERED ||
                btnState === RegistrationButtonState.REGISTRATION_NOT_OPEN
            ) && 'Meld meg på'}
            {btnState === RegistrationButtonState.REGISTERED && 'Meld meg av'}
            {btnState === RegistrationButtonState.ON_WAITING_LIST && 'Meld meg av ventelisten'}
            {btnState === RegistrationButtonState.FULL && 'Fullt'}
            {btnState === RegistrationButtonState.WAITING_LIST_OPEN && 'Meld meg på ventelisten'}
            {btnState === RegistrationButtonState.ERROR && errorText}
            {btnState === RegistrationButtonState.REGISTRATION_CLOSED && 'Påmeldingen er over'}
            {btnState === RegistrationButtonState.BANNED_BY_DOTS && 'Utestengt på grunn av prikker'}
            {btnState === RegistrationButtonState.NOT_ALLOWED && 'Du kan ikke melde deg på dette arrangementet'}
            {btnState === RegistrationButtonState.NOT_ALLOWED && 'Bindende påmelding, du kan ikke melde deg av'}
        </SubmitButton>

        {btnState === RegistrationButtonState.REGISTRATION_NOT_OPEN && (
            <p>Påmeldingen åpner om <CountDown referenceDate={registrationStart} /></p>
        )}

        {!registrationState && capabilities.canRegisterAsAdmin.authorized && (
            <SubmitButton
                success={false}
                color="secondary"
                className="w-full! m-0!"
                onClick={adminButtonOnClick}
                pending={btnPending}
                key={`admin-${btnKey}`}
            >
                Meld meg på som administrator
            </SubmitButton>
        )}

        {showPayment && canPay && event.price && paymentOpen && (
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
            <p>Du har for mange prikker og kan derfor ikke melde deg på arrangementer.</p>
        )}

        {dotPunishment?.type === 'timeout' && (
            <p>
                Du har prikker og må derfor vente {dotPunishment.punishmentMinutes} minutter
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
