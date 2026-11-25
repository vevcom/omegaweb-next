'use client'
import CabinCalendar from './CabinCalendar'
import CabinPriceCalculator from './CabinPriceCalculator'
import SelectBedProducts from './SelectBedProduct'
import TextInput from '@/components/UI/TextInput'
import Textarea from '@/components/UI/Textarea'
import Button from '@/components/UI/Button'
import NumberInput from '@/components/UI/NumberInput'
import Checkbox from '@/components/UI/Checkbox'
import OptionCards from '@/components/UI/OptionCards'
import Form from '@/components/Form/Form'
import CountDown from '@/components/CountDown/CountDown'
import SiteLink from '@/components/SiteLink/SiteLink'
import CabinBookingPaymentModal from '@/components/Ledger/Modals/CabinBookingPaymentModal'
import { calculateCabinBookingPrice, calculateTotalCabinBookingPrice } from '@/services/cabin/booking/cabinPriceCalculator'
import { useSession } from '@/auth/session/useSession'
import { cabinBookingAuth } from '@/services/cabin/booking/auth'
import { Require } from '@/auth/authorizer/Require'
import { omegaAuthLinks } from '@/app/(omegaweb)/(auth)/links'
import { appHref } from '@/lib/sites/href'
import useAuthorizer from '@/hooks/useAuthorizer'
import { createActionError } from '@/services/actionError'
import { configureAction } from '@/services/configureAction'
import {
    createBedBookingUserAttachedAction,
    createCabinBookingUserAttachedAction,
    releaseCabinBookingReservationAction,
} from '@/services/cabin/booking/actions'
import { displayAmount } from '@/lib/currency/convert'
import { displayDate } from '@/lib/dates/displayDate'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CabinBookingReservation } from '@/components/Ledger/Modals/CabinBookingPaymentModal'
import type { CabinProductExtended } from '@/services/cabin/product/types'
import type { BookingFiltered } from '@/services/cabin/booking/types'
import type { DateRange } from './CabinCalendar'
import type { BookingType, PricePeriod } from '@/prisma-generated-pn-types'
import type { ActionReturn } from '@/services/actionTypes'

const sectionClassName = 'bg-base-200 border border-base-300 rounded-round p-6 flex flex-col gap-2'

const bookingTypeOptions = [
    { value: 'CABIN' as BookingType, title: 'Hele hytta', hint: 'Hele Heutten for deg og følget ditt.' },
    { value: 'BED' as BookingType, title: 'Enkeltsenger', hint: 'Del hytta med andre, og betal per seng.' },
]
const sectionHeadingClassName = 'm-0 text-l'

const contactFields = [
    { name: 'firstname', label: 'Fornavn' },
    { name: 'lastname', label: 'Etternavn' },
    { name: 'email', label: 'E-post' },
    { name: 'mobile', label: 'Telefonnummer' },
] as const

type Contact = Record<typeof contactFields[number]['name'], string>

/**
 * Where a reservation is kept across page refreshes (e.g. mid-Stripe-confirmation). Never stores
 * anything but this booking's own id/secret/price. It is kept in
 * sessionStorage, which ends with the tab, under a key per user, so neither a later visitor of the
 * same browser nor another user logging in in the same tab gets the reservation or its secret.
 */
function reservationStorageKey(userId: number) {
    return `cabinBookingReservation:${userId}`
}

function readStoredReservation(storageKey: string): CabinBookingReservation | null {
    try {
        const raw = window.sessionStorage.getItem(storageKey)
        if (!raw) return null

        const stored = JSON.parse(raw) as CabinBookingReservation & { expiresAt: string }
        const expiresAt = new Date(stored.expiresAt)
        if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
            window.sessionStorage.removeItem(storageKey)
            return null
        }

        return { ...stored, expiresAt }
    } catch {
        return null
    }
}

function storeReservation(storageKey: string, reservation: CabinBookingReservation) {
    try {
        window.sessionStorage.setItem(storageKey, JSON.stringify(reservation))
    } catch {
        // Best-effort: if storage is unavailable the payment can still complete now, it just
        // won't be resumable after a refresh.
    }
}

function clearStoredReservation(storageKey: string) {
    try {
        window.sessionStorage.removeItem(storageKey)
    } catch {
        // Ignore.
    }
}

export default function StateWrapper({
    cabinAvailability,
    releaseUntil,
    cabinProducts,
    pricePeriods,
    availableBalance,
    customerSessionClientSecret,
}: {
    cabinAvailability: BookingFiltered[],
    releaseUntil: Date,
    cabinProducts: CabinProductExtended[],
    pricePeriods: PricePeriod[],
    availableBalance?: number,
    customerSessionClientSecret?: string,
}) {
    const session = useSession()
    const user = session.loading ? null : session.session.user
    const canBookCabin = useAuthorizer({
        authorizer: user ? cabinBookingAuth.createCabinBookingUserAttached.data({ userId: user.id }) : Require.user(),
    }).authorized
    const canBookBed = useAuthorizer({
        authorizer: user ? cabinBookingAuth.createBedBookingUserAttached.data({ userId: user.id }) : Require.user(),
    }).authorized
    const cabinProduct = cabinProducts.find(product => product.type === 'CABIN')
    if (!cabinProduct) {
        throw new Error('Ingen produkt med type CABIN.')
    }
    const bedProducts = useMemo(() => cabinProducts.filter(product => product.type === 'BED'), [cabinProducts])

    // canBookCabin is false until the session has loaded, which is after the first render, so the
    // default booking type is derived here rather than fixed in the initial state.
    const [chosenBookingType, setBookingType] = useState<BookingType | null>(null)
    const bookingType = chosenBookingType ?? (canBookCabin ? 'CABIN' : 'BED')
    const [dateRange, setDateRange] = useState<DateRange>({})

    const selectedProducts = useMemo(
        () => (bookingType === 'CABIN' ? [cabinProduct] : bedProducts),
        [bookingType, cabinProduct, bedProducts]
    )
    const [bedAmounts, setBedAmounts] = useState<number[]>(Array(bedProducts.length).fill(0))

    const [numberOfMembers, setNumberOfMembers] = useState(0)
    const [numberOfNonMembers, setNumberOfNonMembers] = useState(0)

    const [tenantNotes, setTenantNotes] = useState('')
    const [acceptedTerms, setAcceptedTerms] = useState(false)
    // Null until the booker changes it, so it follows the profile.
    const [editedContact, setEditedContact] = useState<Contact | null>(null)

    // checked stays false until the effect below runs, so we don't briefly flash the booking
    // form before knowing (from sessionStorage, unavailable during SSR) whether a pending
    // reservation should be resumed instead.
    const [reservationState, setReservationState] = useState<{
        checked: boolean,
        reservation: CabinBookingReservation | null,
    }>({ checked: false, reservation: null })

    // Caches the booking created by getReservation below, so a retried payment submission (e.g.
    // after a declined card) reuses it instead of creating a second, competing booking. Keyed by
    // a snapshot of the inputs it was created from, so changing dates/products/etc. before
    // retrying invalidates it rather than paying for the old, no-longer-displayed booking.
    const reservationCache = useRef<{ reservation: CabinBookingReservation, inputsKey: string } | null>(null)

    const storageKey = user ? reservationStorageKey(user.id) : null

    useEffect(() => {
        if (!storageKey) return
        // Syncs React state with sessionStorage, which cannot be read during render/SSR.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setReservationState({ checked: true, reservation: readStoredReservation(storageKey) })
    }, [storageKey])

    const blockingBookings = useMemo(
        () => (bookingType === 'BED' ? cabinAvailability.filter(booking => booking.type !== 'BED') : cabinAvailability),
        [bookingType, cabinAvailability]
    )

    const calendar = useMemo(() => (
        <CabinCalendar
            key={bookingType}
            bookingUntil={releaseUntil}
            defaultDateRange={dateRange}
            intervalChangeCallback={setDateRange}
            bookings={blockingBookings}
        />
    ), [bookingType, blockingBookings, releaseUntil, dateRange])

    const productAmounts = useMemo(
        () => (bookingType === 'BED' ? bedAmounts : [1]),
        [bookingType, bedAmounts]
    )

    const priceCalculator = useMemo(() => (
        <CabinPriceCalculator
            pricePeriods={pricePeriods}
            products={selectedProducts}
            productAmounts={productAmounts}
            startDate={dateRange.start}
            endDate={dateRange.end}
            numberOfMembers={numberOfMembers}
            numberOfNonMembers={numberOfNonMembers}
        />
    ), [selectedProducts, productAmounts, dateRange, numberOfMembers, numberOfNonMembers, pricePeriods])

    let totalPrice = 0
    if (dateRange.start && dateRange.end) {
        totalPrice = calculateTotalCabinBookingPrice(calculateCabinBookingPrice({
            pricePeriods,
            products: selectedProducts,
            productAmounts,
            startDate: dateRange.start,
            endDate: dateRange.end,
            numberOfMembers,
            numberOfNonMembers,
        }))
    }

    if (session.loading) return <>Laster inn...</>

    if (!user || !storageKey) {
        return <SiteLink href={omegaAuthLinks.login({ callbackUrl: appHref('/cabin/book') })}>
            Logg inn for å booke hytta
        </SiteLink>
    }

    if (!reservationState.checked) return <>Laster inn...</>

    if (!canBookCabin && !canBookBed) {
        return <>Du kan ikke booke hytta.</>
    }

    const { reservation } = reservationState

    // A profile without a phone number leaves it to be filled in here.
    const contact = editedContact ?? {
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        mobile: user.mobile ?? '',
    }

    const canChangeBookingType = canBookCabin && canBookBed

    const summary = (bookingType === 'CABIN' ? 'Hele hytta' : 'Enkeltsenger') + (dateRange.start && dateRange.end
        ? ` · ${displayDate(dateRange.start, false)} – ${displayDate(dateRange.end, false)}`
        : ' · velg datoer i kalenderen')

    const startOver = () => {
        reservationCache.current = null
        clearStoredReservation(storageKey)
        setReservationState({ checked: true, reservation: null })
    }

    // Reserves the booking (first step of the reserve-then-pay flow) right before payment is
    // submitted. cabinBookingOperations.createPayment (called next, inside
    // CabinBookingPaymentModal) never creates a booking itself - it only pays for one created
    // here. Caches the result so a retried payment submission (e.g. after a declined card)
    // reuses the same booking instead of creating a second one that competes for the same dates,
    // but only while the inputs it was created from - and the reservation itself - are still
    // current. Otherwise the displayed price could stop matching what's actually paid for.
    const getReservation = async (): Promise<ActionReturn<CabinBookingReservation>> => {
        if (!dateRange.start || !dateRange.end) {
            return createActionError('BAD PARAMETERS', 'Velg en periode.')
        }

        const bookingProducts = bookingType === 'BED'
            ? bedProducts
                .map((product, index) => ({ cabinProductId: product.id, quantity: bedAmounts[index] }))
                .filter(product => product.quantity > 0)
            : [{ cabinProductId: cabinProduct.id, quantity: 1 }]

        const baseData = {
            start: dateRange.start,
            end: dateRange.end,
            tenantNotes,
            acceptedTerms,
            ...contact,
        }

        const inputsKey = JSON.stringify({ bookingProducts, baseData, numberOfMembers, numberOfNonMembers })

        const cached = reservationCache.current
        if (cached?.inputsKey === inputsKey && cached.reservation.expiresAt.getTime() > Date.now()) {
            return { success: true, data: cached.reservation }
        }

        const createBooking = bookingType === 'CABIN'
            ? createCabinBookingUserAttachedAction
            : createBedBookingUserAttachedAction
        const bookingResult = await createBooking(
            { params: { userId: user.id, bookingProducts } },
            { data: { ...baseData, numberOfMembers, numberOfNonMembers } },
        )
        if (!bookingResult.success) return bookingResult

        if (bookingResult.data.transactionTimeout === null) {
            return createActionError('SERVER ERROR', 'Reservasjonen fikk ingen utløpstid.')
        }

        const reservationData = {
            bookingId: bookingResult.data.id,
            secret: bookingResult.data.secret,
            totalPrice: bookingResult.data.totalPrice,
            expiresAt: bookingResult.data.transactionTimeout,
        }
        reservationCache.current = { reservation: reservationData, inputsKey }

        return { success: true, data: reservationData }
    }

    if (reservation) {
        return <>
            <p>
                Du har en reservasjon som venter på betaling. Den utløper om{' '}
                <CountDown referenceDate={reservation.expiresAt} />.
            </p>
            <CabinBookingPaymentModal
                funds={reservation.totalPrice}
                availablePaymentMethods={['STRIPE', 'MANUAL']}
                availableBalance={availableBalance}
                customerSessionClientSecret={customerSessionClientSecret}
                getReservation={() => ({ success: true, data: reservation })}
                triggerLabel="Fullfør betaling"
            >
                <p>Reservasjon #{reservation.bookingId}</p>
            </CabinBookingPaymentModal>
            <Form
                action={configureAction(releaseCabinBookingReservationAction, {
                    params: { bookingId: reservation.bookingId, secret: reservation.secret },
                })}
                successCallback={startOver}
                submitText="Avbryt og start på nytt"
                submitColor="red"
            />
        </>
    }

    return <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2 items-start">
            <div className="flex-[999_1_560px] min-w-0 flex flex-col gap-2">
                {canChangeBookingType &&
                    <section className={sectionClassName}>
                        <h2 className={sectionHeadingClassName}>1. Hva vil du booke?</h2>
                        <OptionCards options={bookingTypeOptions} value={bookingType} onChange={setBookingType} />
                    </section>
                }

                <section className={sectionClassName}>
                    <h2 className={sectionHeadingClassName}>{canChangeBookingType ? '2. ' : ''}Velg datoer</h2>
                    {calendar}
                </section>

                <section className={sectionClassName}>
                    <h2 className={sectionHeadingClassName}>
                        {canChangeBookingType ? '3. ' : ''}{bookingType === 'BED' ? 'Hvor mange senger?' : 'Hvem blir med?'}
                    </h2>
                    {bookingType === 'CABIN' && <div className="flex flex-wrap gap-2">
                        <NumberInput
                            name="numberOfMembers"
                            label="Antall som er medlem i Omega"
                            background="base100"
                            value={numberOfMembers}
                            onChange={(e) => {
                                const value = Number(e.target.value)
                                if (value >= 0) {
                                    setNumberOfMembers(value)
                                }
                            }}
                        />
                        <NumberInput
                            name="numberOfNonMembers"
                            label="Antall som ikke er medlem i Omega"
                            background="base100"
                            value={numberOfNonMembers}
                            onChange={(e) => {
                                const value = Number(e.target.value)
                                if (value >= 0) {
                                    setNumberOfNonMembers(value)
                                }
                            }}
                        />
                        <p className="m-0 text-s text-base-content/80">
                            Helgeprisen avhenger av hvor stor andel av følget som er medlemmer.
                        </p>
                    </div>}

                    {bookingType === 'BED' && <div className="flex flex-wrap gap-2">
                        <SelectBedProducts
                            amounts={bedAmounts}
                            bedProducts={bedProducts}
                            onChange={setBedAmounts}
                        />
                    </div>}
                </section>

                <section className={sectionClassName}>
                    <h2 className={sectionHeadingClassName}>{canChangeBookingType ? '4. ' : ''}Kontaktinfo</h2>
                    {editedContact || !user.mobile ? <div className="
                        grid grid-cols-2 gap-2
                        max-mobile:grid-cols-1
                    ">
                        {contactFields.map(field => (
                            <TextInput
                                key={field.name}
                                name={field.name}
                                label={field.label}
                                background="base100"
                                value={contact[field.name]}
                                onChange={e => setEditedContact({ ...contact, [field.name]: e.target.value })}
                            />
                        ))}
                    </div> : <>
                        <dl className="
                            m-0 grid grid-cols-2 gap-2
                            max-mobile:grid-cols-1
                        ">
                            {[
                                ['Navn', `${contact.firstname} ${contact.lastname}`],
                                ['E-post', contact.email],
                                ['Telefon', contact.mobile],
                            ].map(([term, value]) => (
                                <div key={term}>
                                    <dt className="text-s text-base-content/80">{term}</dt>
                                    <dd className="m-0">{value}</dd>
                                </div>
                            ))}
                        </dl>
                        <p className="m-0 text-s text-base-content/80">
                            Hentet fra profilen din.{' '}
                            <Button variant="text" onClick={() => setEditedContact(contact)}>
                                Endre for denne bookingen
                            </Button>
                        </p>
                    </>}
                    <Textarea
                        name="tenantNotes"
                        label="Beskjed til hyttestyret (valgfritt)"
                        background="raised"
                        value={tenantNotes}
                        onChange={e => setTenantNotes(e.target.value)}
                    />
                </section>
            </div>

            <aside id="cabin-booking-summary" className={`
                ${sectionClassName}
                flex-[1_1_320px] min-w-0
                mobile:sticky mobile:top-4
            `}>
                <h2 className={sectionHeadingClassName}>Din booking</h2>
                <p className="m-0">{summary}</p>
                {priceCalculator}

                <Checkbox
                    name="acceptedTerms"
                    checked={acceptedTerms}
                    onChange={e => setAcceptedTerms(e.target.checked)}
                >
                    <span>Jeg har lest og godtar <a href="#cabin-contract">leievilkårene</a></span>
                </Checkbox>
                {acceptedTerms && totalPrice > 0 ? <CabinBookingPaymentModal
                    funds={totalPrice}
                    availablePaymentMethods={['STRIPE', 'MANUAL']}
                    availableBalance={availableBalance}
                    customerSessionClientSecret={customerSessionClientSecret}
                    getReservation={getReservation}
                    onReservationCreated={createdReservation => storeReservation(storageKey, createdReservation)}
                    triggerLabel="Gå til betaling"
                >
                    <p className="m-0">{summary}</p>
                </CabinBookingPaymentModal> : <>
                    <Button color="primary" disabled>Gå til betaling</Button>
                    <p className="m-0 text-s text-base-content/80">
                        {totalPrice > 0 ? 'Godta leievilkårene for å gå videre.' : 'Velg datoer for å gå videre.'}
                    </p>
                </>}
                <p className="m-0 text-s text-base-content/80">
                    Datoene holdes av for deg i noen minutter mens du betaler.
                </p>
            </aside>
        </div>

        {dateRange.start && dateRange.end &&
            <a
                href="#cabin-booking-summary"
                className="
                    mobile:hidden
                    sticky bottom-0 px-4 py-2 rounded-round bg-base-100 border-t border-base-300 flex items-center
                    justify-between gap-3 no-underline text-base-content
                "
            >
                <b className="text-l">{displayAmount(totalPrice)}</b>
                <span className="rounded-inner bg-primary text-primary-content px-4 py-2">Til betaling</span>
            </a>
        }
    </div>
}
