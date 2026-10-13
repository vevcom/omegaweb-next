'use client'
import CabinCalendar from './CabinCalendar'
import CabinPriceCalculator from './CabinPriceCalculator'
import SelectBedProducts from './SelectBedProduct'
import RadioLarge from '@/components/UI/RadioLarge'
import TextInput from '@/components/UI/TextInput'
import NumberInput from '@/components/UI/NumberInput'
import Checkbox from '@/components/UI/Checkbox'
import Form from '@/components/Form/Form'
import CountDown from '@/components/countDown/CountDown'
import CabinBookingPaymentModal from '@/components/Ledger/Modals/CabinBookingPaymentModal'
import { calculateCabinBookingPrice, calculateTotalCabinBookingPrice } from '@/services/cabin/booking/cabinPriceCalculator'
import { useSession } from '@/auth/session/useSession'
import { cabinBookingAuth } from '@/services/cabin/booking/auth'
import useAuthorizer from '@/hooks/useAuthorizer'
import { createActionError } from '@/services/actionError'
import { configureAction } from '@/services/configureAction'
import {
    createBedBookingNoUserAction,
    createBedBookingUserAttachedAction,
    createCabinBookingNoUserAction,
    createCabinBookingUserAttachedAction,
    releaseCabinBookingReservationAction,
} from '@/services/cabin/booking/actions'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CabinBookingReservation } from '@/components/Ledger/Modals/CabinBookingPaymentModal'
import type { CabinProductExtended } from '@/services/cabin/product/types'
import type { BookingFiltered } from '@/services/cabin/booking/types'
import type { DateRange } from './CabinCalendar'
import type { BookingType, PricePeriod } from '@/prisma-generated-pn-types'
import type { ActionReturn } from '@/services/actionTypes'

/**
 * Where a reservation is kept across page refreshes (e.g. mid-Stripe-confirmation), including for
 * guest bookings which have no session to resume from. Never stores anything but this booking's
 * own id/secret/price - the secret is what proves ownership without a login. It is kept in
 * sessionStorage, which ends with the tab, under a key per user, so neither a later visitor of the
 * same browser nor another user logging in in the same tab gets the reservation or its secret.
 */
function reservationStorageKey(userId: number | null) {
    return `cabinBookingReservation:${userId ?? 'guest'}`
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
    const canBookCabin = useAuthorizer({ authorizer: cabinBookingAuth.createCabinBookingNoUser }).authorized
    const canBookBed = useAuthorizer({ authorizer: cabinBookingAuth.createBedBookingNoUser }).authorized
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

    // Only editable for guest bookings. Logged in users are pre-filled and locked below.
    const [tenantNotes, setTenantNotes] = useState('')
    const [firstname, setFirstname] = useState('')
    const [lastname, setLastname] = useState('')
    const [email, setEmail] = useState('')
    const [mobile, setMobile] = useState('')

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

    const session = useSession()
    const storageKey = session.loading ? null : reservationStorageKey(session.session.user?.id ?? null)

    useEffect(() => {
        if (!storageKey) return
        // Syncs React state with sessionStorage, which cannot be read during render/SSR.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setReservationState({ checked: true, reservation: readStoredReservation(storageKey) })
    }, [storageKey])

    const calendar = useMemo(() => (
        <CabinCalendar
            startDate={new Date()}
            bookingUntil={releaseUntil}
            defaultDateRange={dateRange}
            intervalChangeCallback={setDateRange}
            bookings={cabinAvailability}
        />
    ), [cabinAvailability, releaseUntil, dateRange])

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

    if (session.loading || !reservationState.checked || !storageKey) {
        return <>Laster session...</>
    }

    if (!canBookCabin && !canBookBed) {
        return <>Du kan ikke booke hytta.</>
    }

    const { reservation } = reservationState

    const canChangeBookingType = canBookCabin && canBookBed

    const user = session.session.user

    const contactFirstname = user?.firstname ?? firstname
    const contactLastname = user?.lastname ?? lastname
    const contactEmail = user?.email ?? email
    const contactMobile = user?.mobile ?? mobile

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
            // Only reachable once the required "acceptedTerms" checkbox below has actually been
            // checked - the browser's own HTML5 validation blocks submission otherwise, the same
            // way LedgerTransactionModal's "iUseThisWithCare" checkbox already works elsewhere.
            acceptedTerms: true,
        }

        const inputsKey = JSON.stringify(user
            ? { bookingProducts, baseData, numberOfMembers, numberOfNonMembers }
            : { bookingProducts, baseData, firstname, lastname, email, mobile })

        const cached = reservationCache.current
        if (cached && cached.inputsKey === inputsKey && cached.reservation.expiresAt.getTime() > Date.now()) {
            return { success: true, data: cached.reservation }
        }

        const bookingResult = user
            ? await (bookingType === 'CABIN' ? createCabinBookingUserAttachedAction : createBedBookingUserAttachedAction)(
                { params: { userId: user.id, bookingProducts } },
                { data: { ...baseData, numberOfMembers, numberOfNonMembers } },
            )
            : await (bookingType === 'CABIN' ? createCabinBookingNoUserAction : createBedBookingNoUserAction)(
                { params: { bookingProducts } },
                { data: { ...baseData, firstname, lastname, email, mobile } },
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
                availablePaymentMethods={user ? ['STRIPE', 'MANUAL'] : ['STRIPE']}
                availableBalance={user ? availableBalance : undefined}
                customerSessionClientSecret={user ? customerSessionClientSecret : undefined}
                getReservation={async () => ({ success: true, data: reservation })}
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

    return <>
        {calendar}

        {canChangeBookingType &&
            <RadioLarge
                name="Select type"
                options={[
                    {
                        value: 'CABIN',
                        label: 'Hele hytta',
                    },
                    {
                        value: 'BED',
                        label: 'Enkelt seng'
                    }
                ]}
                value={bookingType}
                onChange={setBookingType}
            />
        }

        {(bookingType === 'CABIN' && user) && <>
            <NumberInput
                name="numberOfMembers"
                label="Antall som er medlem i Omega"
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
                value={numberOfNonMembers}
                onChange={(e) => {
                    const value = Number(e.target.value)
                    if (value >= 0) {
                        setNumberOfNonMembers(value)
                    }
                }}
            />
        </>}

        {bookingType === 'BED' && <>
            <SelectBedProducts
                amounts={bedAmounts}
                bedProducts={bedProducts}
                onChange={setBedAmounts}
            />
        </>}

        {priceCalculator}

        <CabinBookingPaymentModal
            funds={totalPrice}
            availablePaymentMethods={user ? ['STRIPE', 'MANUAL'] : ['STRIPE']}
            availableBalance={user ? availableBalance : undefined}
            customerSessionClientSecret={user ? customerSessionClientSecret : undefined}
            getReservation={getReservation}
            onReservationCreated={createdReservation => storeReservation(storageKey, createdReservation)}
        >
            <TextInput
                name="firstname"
                label="Fornavn"
                value={contactFirstname}
                onChange={e => setFirstname(e.target.value)}
                disabled={Boolean(user)}
                readOnly={Boolean(user)}
            />
            <TextInput
                name="lastname"
                label="Etternavn"
                value={contactLastname}
                onChange={e => setLastname(e.target.value)}
                disabled={Boolean(user)}
                readOnly={Boolean(user)}
            />
            <TextInput
                name="email"
                label="E-post"
                value={contactEmail}
                onChange={e => setEmail(e.target.value)}
                disabled={Boolean(user)}
                readOnly={Boolean(user)}
            />
            <TextInput
                name="mobile"
                label="Telefonnummer"
                value={contactMobile}
                onChange={e => setMobile(e.target.value)}
                disabled={Boolean(user)}
                readOnly={Boolean(user)}
            />

            <TextInput
                name="tenantNotes"
                label="Notater til utleier"
                value={tenantNotes}
                onChange={e => setTenantNotes(e.target.value)}
            />

            <Checkbox name="acceptedTerms" label="Jeg godtar vilkårene under" required />
        </CabinBookingPaymentModal>
    </>
}
