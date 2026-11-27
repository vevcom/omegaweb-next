'use client'
import EventSlotPicker from './EventSlotPicker'
import CountDown from '@/components/CountDown/CountDown'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import SubmitButton from '@/components/UI/SubmitButton'
import {
    createEventRegistrationAction,
    createEventRegistrationAsAdminAction,
    destroyEventRegistrationAction,
    destroyEventRegistrationAsAdminAction,
    moveEventRegistrationToSlotAction,
    updateEventRegistrationNotesAction
} from '@/services/events/registration/actions'
import { displaySlot, slotClock } from '@/services/events/slots/display'
import { configureAction } from '@/services/configureAction'
import { authLinks } from '@/pageKits/auth/links'
import { eventLinks } from '@/pageKits/events/links'
import SiteLink from '@/components/SiteLink/SiteLink'
import useSiteRouter from '@/hooks/useSiteRouter'
import { useEffect, useReducer, useState } from 'react'
import { useSession } from 'next-auth/react'
import type { EventExpanded, EventVariantSummary } from '@/services/events/types'
import type { DotPunishment } from '@/services/events/registration/types'
import type { SlotOfVariant } from '@/services/events/slots/types'
import type { CapabilitiesJsObject } from '@/auth/authorizer/capabilities'
import type { EventRegistration } from '@/prisma-generated-pn-types'
import type { EventPagesConfig } from '@/pageKits/events/config'

/**
 * Whether the viewer passes a quota of the variant, and whether one they pass has a place left. A
 * refusal is why they may not register for want of a seat on the presentation the event requires.
 */
export type RegistrationEligibility = {
    seatRefusal: string | null,
    passesAnyQuota: boolean,
    placeAvailable: boolean,
}

type OwnRegistration = Pick<EventRegistration, 'id' | 'state' | 'note' | 'slotId'>

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
    NO_PRESENTATION_SEAT = 'NO_PRESENTATION_SEAT',
    ERROR = 'ERROR',
}

export default function RegistrationUI({
    config,
    event,
    variant,
    registration,
    slots,
    dotPunishment,
    eligibility,
    capabilities,
}: {
    /** The event pages the registration sits in, whose site's login a visitor is sent to. */
    config: EventPagesConfig,
    event: Pick<EventExpanded, 'id' | 'kind' | 'name' | 'waitingList' | 'bindingRegistration'>,
    variant: Pick<EventVariantSummary, 'id' | 'registrationStart' | 'registrationEnd' | 'takesRegistration'>,
    registration: OwnRegistration | null,
    /** The slots of a slotted variant, which a registration with a place holds one of. Null for a list. */
    slots: SlotOfVariant[] | null,
    dotPunishment: DotPunishment | null,
    eligibility: RegistrationEligibility,
    capabilities: CapabilitiesJsObject<'canRegister' | 'canRegisterAsAdmin' | 'canUnregisterAsAdmin'>,
}) {
    if (!variant.takesRegistration) {
        throw new Error('Kan bare vise påmeldingsknapp for en variant som har påmelding')
    }

    // Dots push the start back for the user.
    const delayMs = dotPunishment?.type === 'timeout' ? dotPunishment.punishmentMinutes * 60 * 1000 : 0
    const registrationStart = new Date(variant.registrationStart.getTime() + delayMs)

    const getInitialBtnState = (ownRegistration: OwnRegistration | null) => {
        if (ownRegistration) {
            return ownRegistration.state === 'WAITING_LIST'
                ? RegistrationButtonState.ON_WAITING_LIST
                : RegistrationButtonState.REGISTERED
        }
        if (dotPunishment?.type === 'ban') {
            return RegistrationButtonState.BANNED_BY_DOTS
        }
        if (!capabilities.canRegister.authorized || !eligibility.passesAnyQuota) {
            return RegistrationButtonState.NOT_ALLOWED
        }
        if (eligibility.seatRefusal) {
            return RegistrationButtonState.NO_PRESENTATION_SEAT
        }
        if (registrationStart > new Date()) {
            return RegistrationButtonState.REGISTRATION_NOT_OPEN
        }
        if (variant.registrationEnd < new Date()) {
            return RegistrationButtonState.REGISTRATION_CLOSED
        }
        if (!eligibility.placeAvailable) {
            return event.waitingList ? RegistrationButtonState.WAITING_LIST_OPEN : RegistrationButtonState.FULL
        }
        return RegistrationButtonState.NOT_REGISTERED
    }

    const [errorText, setErrorText] = useState('')
    const [registrationState, setRegistrationState] = useState<OwnRegistration | null>(registration)
    // A refresh brings the registration, the places and the slots as they are now, and the state follows them.
    const [registrationShown, setRegistrationShown] = useState(registration)
    if (registration !== registrationShown) {
        setRegistrationShown(registration)
        setRegistrationState(registration)
    }

    const [failed, setFailed] = useState(false)
    const btnState = failed ? RegistrationButtonState.ERROR : getInitialBtnState(registrationState)
    const [, renderAgain] = useReducer((renders: number) => renders + 1, 0)
    const [btnPending, setBtnPending] = useState(false)
    const [btnKey, setBtnKey] = useState(1)
    const [pickedSlotId, setPickedSlotId] = useState<number | null>(null)
    const [slotError, setSlotError] = useState('')

    const session = useSession()

    // The rest of the page, such as the payment section, is rendered on the server from the
    // registration, so it is refreshed once the registration changes.
    const { refresh } = useSiteRouter()

    useEffect(() => {
        const timeUntilRegistration = registrationStart.getTime() - Date.now()
        let timeoutId: ReturnType<typeof setTimeout>
        if (timeUntilRegistration > 0) {
            timeoutId = setTimeout(renderAgain, timeUntilRegistration)
        }

        return () => {
            if (timeoutId) {
                clearTimeout(timeoutId)
            }
        }
    })

    // Only a user registers for an event. A company user is signed in already, so only a visitor is offered the login.
    if (session.data?.companyUser) {
        return <p className="m-0 text-base-content/80">Du kan ikke melde deg på som bedrift.</p>
    }
    if (!session.data?.user) {
        const loginHref = authLinks(config.authPages).login({ callbackUrl: eventLinks(config).event(event) })
        return <SiteLink href={loginHref}>Logg inn for å melde deg på</SiteLink>
    }

    const userId = session.data.user.id
    // A free place on a slotted variant is taken in the slot picked, and one waits for any slot.
    const mustPickSlot = slots !== null && btnState === RegistrationButtonState.NOT_REGISTERED
    // A slot taken since it was picked is picked no longer.
    const pickedSlot = slots?.find(slot => slot.id === pickedSlotId && slot.free) ?? null

    const register = async (
        // Separate implementations of one sub-operation, which may diverge.
        // eslint-disable-next-line @typescript-eslint/no-duplicate-type-constituents
        createAction: typeof createEventRegistrationAction | typeof createEventRegistrationAsAdminAction,
        slotId: number | undefined,
    ) => {
        const result = await createAction({
            params: {
                userId,
                eventId: event.id,
                variantId: variant.id,
                slotId,
            }
        })

        if (result.success) {
            setRegistrationState(result.data)
            setPickedSlotId(null)
            setSlotError('')
            refresh()
        } else if (slots) {
            // The slot may have been taken meanwhile, so the slots are read again to pick another.
            setSlotError(result.error?.[0]?.message ?? 'Kunne ikke melde deg på.')
            setPickedSlotId(null)
            refresh()
        } else if (result.error && result.error.length > 0) {
            const message = result.error[0].message
            setErrorText(message)
            setFailed(true)
        } else {
            setErrorText('Kunne ikke melde deg på.')
            setFailed(true)
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
            setRegistrationState(null)
            refresh()
        } else if (result.error && result.error.length > 0) {
            const message = result.error[0].message
            setErrorText(message)
            setFailed(true)
        } else {
            setErrorText('Kunne ikke melde deg av.')
            setFailed(true)
        }
    }

    const moveToSlot = async () => {
        if (!registrationState || !pickedSlot) return
        setBtnPending(true)
        const result = await moveEventRegistrationToSlotAction(
            { params: { registrationId: registrationState.id } },
            { data: { slotId: pickedSlot.id } },
        )
        if (result.success) {
            setRegistrationState({ ...registrationState, slotId: pickedSlot.id })
            setSlotError('')
        } else {
            setSlotError(result.error?.[0]?.message ?? 'Kunne ikke bytte tidsluke.')
        }
        setPickedSlotId(null)
        refresh()
        setBtnPending(false)
    }

    const buttonOnClick = async () => {
        setBtnPending(true)
        if (registrationState) {
            await unregister(destroyEventRegistrationAction)
        } else {
            await register(createEventRegistrationAction, mustPickSlot ? pickedSlot?.id : undefined)
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
            await register(createEventRegistrationAsAdminAction, pickedSlot?.id)
        }
        setBtnPending(false)
        setBtnKey(btnKey + 1)
    }

    const isRegistered = btnState === RegistrationButtonState.REGISTERED ||
        btnState === RegistrationButtonState.ON_WAITING_LIST
    const mayRegister = (btnState === RegistrationButtonState.NOT_REGISTERED && !(mustPickSlot && !pickedSlot))
        || btnState === RegistrationButtonState.WAITING_LIST_OPEN
    // A place is given up within the registration period; the waiting list is left at any time. A
    // binding registration, or one past the deadline, is only taken back by those who administrate
    // the event. The note, though, closes with the deadline for everyone registered.
    const deadlinePassed = variant.registrationEnd < new Date()
    const registrationClosed = registrationState?.state === 'IN_QUOTA' && deadlinePassed
    const mayUnregister = isRegistered && !event.bindingRegistration && !registrationClosed
    const heldSlotId = registrationState?.slotId ?? null
    const heldSlot = slots?.find(slot => slot.id === heldSlotId)
    const registrationOpen = variant.registrationStart <= new Date() && !deadlinePassed
    const maySwitchSlot = heldSlotId !== null && registrationOpen

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
        {slots && <EventSlotPicker
            slots={slots}
            heldSlotId={heldSlotId}
            pickedSlotId={pickedSlot?.id ?? null}
            onPick={setPickedSlotId}
            picking={mustPickSlot || maySwitchSlot || (!registrationState && capabilities.canRegisterAsAdmin.authorized)}
        />}
        {heldSlot && <p className="m-0">Din tidsluke: <strong>{displaySlot(heldSlot)}</strong></p>}
        {slotError && <p className="m-0 text-error">{slotError}</p>}
        {maySwitchSlot && pickedSlot && pickedSlot.id !== heldSlotId && (
            <SubmitButton
                success={false}
                color="secondary"
                className="w-full! m-0!"
                onClick={moveToSlot}
                pending={btnPending}
                key={`switch-${btnKey}`}
            >
                Bytt til {slotClock(pickedSlot)}
            </SubmitButton>
        )}

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
            {btnState === RegistrationButtonState.NOT_REGISTERED && (
                mustPickSlot && !pickedSlot ? 'Velg en tidsluke' : 'Meld meg på'
            )}
            {btnState === RegistrationButtonState.REGISTRATION_NOT_OPEN && 'Meld meg på'}
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
            {btnState === RegistrationButtonState.NO_PRESENTATION_SEAT && eligibility.seatRefusal}
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

        {registrationState && !deadlinePassed && <Form
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
