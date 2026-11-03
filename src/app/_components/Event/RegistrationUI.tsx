'use client'
import CountDown from '@/components/CountDown/CountDown'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import SubmitButton from '@/components/UI/SubmitButton'
import {
    createEventRegistrationAction,
    createEventRegistrationAsAdminAction,
    destroyEventRegistrationAction,
    destroyEventRegistrationAsAdminAction,
    updateEventRegistrationNotesAction
} from '@/services/events/registration/actions'
import { configureAction } from '@/services/configureAction'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
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
    capabilities,
}: {
    event: EventExpanded,
    registration: EventRegistrationWithWaitingList | null,
    dotPunishment: DotPunishment | null,
    capabilities: CapabilitiesJsObject<'canRegister' | 'canRegisterAsAdmin' | 'canUnregisterAsAdmin'>,
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
    // The rest of the page, such as the payment section, is rendered on the server from the
    // registration, so it is refreshed once the registration changes.
    const { refresh } = useRouter()

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
            refresh()
        } else if (result.error && result.error.length > 0) {
            const message = result.error[0].message
            setErrorText(message)
            setBtnState(RegistrationButtonState.ERROR)
        } else {
            setErrorText('Kunne ikke melde deg på.')
            setBtnState(RegistrationButtonState.ERROR)
        }
    }

    const unregister = async (
        // Separate implementations of one sub-operation, which may diverge.
        // eslint-disable-next-line @typescript-eslint/no-duplicate-type-constituents
        destroyAction: typeof destroyEventRegistrationAction | typeof destroyEventRegistrationAsAdminAction
    ) => {
        if (!registrationState) return
        const result = await destroyAction({
            params: { registrationId: registrationState.id },
        })

        if (result.success) {
            setBtnState(getInitialBtnState(null))
            setRegistrationState(null)
            refresh()
        } else if (result.error && result.error.length > 0) {
            const message = result.error[0].message
            setErrorText(message)
            setBtnState(RegistrationButtonState.ERROR)
        } else {
            setErrorText('Kunne ikke melde deg av.')
            setBtnState(RegistrationButtonState.ERROR)
        }
    }

    const buttonOnClick = async () => {
        setBtnPending(true)
        if (registrationState) {
            await unregister(destroyEventRegistrationAction)
        } else {
            await register(createEventRegistrationAction)
        }
        setBtnPending(false)
        setBtnKey(btnKey + 1)
    }

    // Administrators of the event register outside the registration period and past their own dots,
    // and unregister from a binding registration or after the deadline, through buttons of their
    // own, so that it is clear it is not an ordinary registration.
    const adminButtonOnClick = async () => {
        setBtnPending(true)
        if (registrationState) {
            await unregister(destroyEventRegistrationAsAdminAction)
        } else {
            await register(createEventRegistrationAsAdminAction)
        }
        setBtnPending(false)
        setBtnKey(btnKey + 1)
    }

    const isRegistered = btnState === RegistrationButtonState.REGISTERED ||
        btnState === RegistrationButtonState.ON_WAITING_LIST
    const mayRegister = btnState === RegistrationButtonState.NOT_REGISTERED ||
        btnState === RegistrationButtonState.WAITING_LIST_OPEN
    // A binding registration, or one past the deadline, is only taken back by those who administrate
    // the event.
    const registrationClosed = event.registrationEnd < new Date()
    const mayUnregister = isRegistered && !event.bindingRegistration && !registrationClosed

    const confirmation = () => {
        if (mayUnregister) {
            return { confirm: true, text: 'Er du sikker på at du vil melde deg av?' }
        }
        if (mayRegister && event.bindingRegistration) {
            return { confirm: true, text: 'Påmeldingen er bindende. Er du sikker på at du vil melde deg på?' }
        }
        return undefined
    }

    return <>
        <SubmitButton
            success={false}
            confirmation={confirmation()}
            disabled={!mayRegister && !mayUnregister}
            color={mayUnregister ? 'red' : 'primary'}
            className="w-full! m-0!"
            onClick={buttonOnClick}
            pending={btnPending}
            key={btnKey}
        >
            {(
                btnState === RegistrationButtonState.NOT_REGISTERED ||
                btnState === RegistrationButtonState.REGISTRATION_NOT_OPEN
            ) && 'Meld meg på'}
            {btnState === RegistrationButtonState.REGISTERED && (mayUnregister ? 'Meld meg av' : 'Påmeldt')}
            {btnState === RegistrationButtonState.ON_WAITING_LIST && (
                mayUnregister ? 'Meld meg av ventelisten' : 'På ventelisten'
            )}
            {btnState === RegistrationButtonState.FULL && 'Fullt'}
            {btnState === RegistrationButtonState.WAITING_LIST_OPEN && 'Meld meg på ventelisten'}
            {btnState === RegistrationButtonState.ERROR && errorText}
            {btnState === RegistrationButtonState.REGISTRATION_CLOSED && 'Påmeldingen er over'}
            {btnState === RegistrationButtonState.BANNED_BY_DOTS && 'Utestengt på grunn av prikker'}
            {btnState === RegistrationButtonState.NOT_ALLOWED && 'Du kan ikke melde deg på dette arrangementet'}
        </SubmitButton>

        {btnState === RegistrationButtonState.REGISTRATION_NOT_OPEN && (
            <p>Påmeldingen åpner om <CountDown referenceDate={registrationStart} /></p>
        )}

        {isRegistered && event.bindingRegistration && (
            <p>Påmeldingen er bindende. Ta kontakt med arrangørene om du ikke kan komme.</p>
        )}
        {isRegistered && !event.bindingRegistration && registrationClosed && (
            <p>Påmeldingsfristen er over. Ta kontakt med arrangørene om du ikke kan komme.</p>
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

        {registrationState && !mayUnregister && capabilities.canUnregisterAsAdmin.authorized && (
            <SubmitButton
                success={false}
                color="secondary"
                confirmation={{ confirm: true, text: 'Er du sikker på at du vil melde deg av?' }}
                className="w-full! m-0!"
                onClick={adminButtonOnClick}
                pending={btnPending}
                key={`admin-${btnKey}`}
            >
                Meld meg av som administrator
            </SubmitButton>
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

        {registrationState && !registrationClosed && <Form
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
