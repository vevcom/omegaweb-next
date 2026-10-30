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
import type { DotPunishment } from '@/services/events/registration/types'
import type { CapabilitiesJsObject } from '@/auth/authorizer/capabilities'
import type { EventRegistration } from '@/prisma-generated-pn-types'

/**
 * What the quotas the viewer passes add up to for them: when the first of them opens and the last
 * closes, and whether one that is open has a place left.
 */
export type RegistrationEligibility = {
    passesAnyQuota: boolean,
    opensAt: Date | null,
    closesAt: Date | null,
    placeAvailable: boolean,
}

/** What the button needs of the viewer's registration, as read and as returned by registering. */
type OwnRegistration = Pick<EventRegistration, 'id' | 'state' | 'note'> & {
    quota?: { registrationEnd: Date } | null,
}

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
    eligibility,
    capabilities,
}: {
    event: EventExpanded,
    registration: OwnRegistration | null,
    dotPunishment: DotPunishment | null,
    eligibility: RegistrationEligibility,
    capabilities: CapabilitiesJsObject<'canRegister' | 'canRegisterAsAdmin' | 'canUnregisterAsAdmin'>,
}) {
    if (!event.takesRegistration) {
        throw new Error('Kan bare vise påmeldingsknapp for arrangement som har påmelding')
    }

    // Dots push the start of every quota back for the user, so it is the delayed start of the first
    // quota they pass that decides when the button opens.
    const delayMs = dotPunishment?.type === 'timeout' ? dotPunishment.punishmentMinutes * 60 * 1000 : 0
    const registrationStart = eligibility.opensAt ? new Date(eligibility.opensAt.getTime() + delayMs) : null

    const getInitialBtnState = (ownRegistration: OwnRegistration | null) => {
        if (ownRegistration) {
            return ownRegistration.state === 'WAITING_LIST'
                ? RegistrationButtonState.ON_WAITING_LIST
                : RegistrationButtonState.REGISTERED
        }
        if (dotPunishment?.type === 'ban') {
            return RegistrationButtonState.BANNED_BY_DOTS
        }
        // Registering takes passing the visibility of one of the quotas.
        if (!capabilities.canRegister.authorized || !eligibility.passesAnyQuota || !registrationStart) {
            return RegistrationButtonState.NOT_ALLOWED
        }
        if (registrationStart > new Date()) {
            return RegistrationButtonState.REGISTRATION_NOT_OPEN
        }
        if (eligibility.closesAt && eligibility.closesAt < new Date()) {
            return RegistrationButtonState.REGISTRATION_CLOSED
        }
        if (!eligibility.placeAvailable) {
            return event.waitingList ? RegistrationButtonState.WAITING_LIST_OPEN : RegistrationButtonState.FULL
        }
        return RegistrationButtonState.NOT_REGISTERED
    }

    const [errorText, setErrorText] = useState('')
    const [registrationState, setRegistrationState] = useState<OwnRegistration | null>(registration)

    const [btnState, setBtnState] = useState(getInitialBtnState(registration))
    const [btnPending, setBtnPending] = useState(false)
    const [btnKey, setBtnKey] = useState(1)

    const session = useSession()
    // The rest of the page, such as the payment section, is rendered on the server from the
    // registration, so it is refreshed once the registration changes.
    const { refresh } = useRouter()

    useEffect(() => {
        const timeUntilRegistration = registrationStart ? registrationStart.getTime() - Date.now() : 0
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
    // A place is given up within the registration period of its quota; the waiting list is left at
    // any time. A binding registration, or one past the deadline, is only taken back by those who
    // administrate the event.
    const deadline = registrationState?.quota?.registrationEnd ?? null
    const registrationClosed = deadline !== null && deadline < new Date()
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

        {btnState === RegistrationButtonState.REGISTRATION_NOT_OPEN && registrationStart && (
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
