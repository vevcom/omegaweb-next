'use client'

import LedgerTransactionModal from './LedgerTransactionModal'
import { displayAmount } from '@/lib/currency/convert'
import { createCabinBookingPaymentAction } from '@/services/cabin/booking/actions'
import type { LedgerTransactionPaymentMethod } from './LedgerTransactionModal'
import type { ActionReturn } from '@/services/actionTypes'
import type { ReactNode } from 'react'
import type { Awaitable } from '@/lib/awaitable'

export type CabinBookingReservation = {
    bookingId: number,
    secret: string,
    totalPrice: number,
    expiresAt: Date,
}

type Props = {
    funds: number,
    children: ReactNode,
    availableBalance?: number,
    availablePaymentMethods?: LedgerTransactionPaymentMethod[],
    customerSessionClientSecret?: string,
    triggerLabel?: ReactNode,
    // Creates (or, when resuming an already-reserved booking, simply returns) the booking to pay
    // for. Which of the create*/createBed* actions this calls - and whether one is even needed -
    // varies per caller, so it stays a callback rather than logic owned by this component.
    getReservation: () => Awaitable<ActionReturn<CabinBookingReservation>>,
    onReservationCreated?: (reservation: CabinBookingReservation) => void,
}

export default function CabinBookingPaymentModal({
    funds,
    children,
    availableBalance,
    availablePaymentMethods,
    customerSessionClientSecret,
    triggerLabel = 'Betal og book',
    getReservation,
    onReservationCreated,
}: Props) {
    return <LedgerTransactionModal
        popUpKey="cabinBookingPaymentModal"
        triggerLabel={triggerLabel}
        title="Betal for hyttebooking"
        submitText="Betal og book"
        funds={funds}
        availableBalance={availableBalance}
        availablePaymentMethods={availablePaymentMethods ?? ['STRIPE', 'MANUAL']}
        customerSessionClientSecret={customerSessionClientSecret}
        refreshOnSuccess
        onSubmitAction={async ({ paymentMethod, amountFromBalance, manualFees, description }) => {
            const reservationResult = await getReservation()
            if (!reservationResult.success) return reservationResult

            const reservation = reservationResult.data
            onReservationCreated?.(reservation)

            return createCabinBookingPaymentAction({
                params: {
                    bookingId: reservation.bookingId,
                    secret: reservation.secret,
                    provider: paymentMethod,
                    amountFromBalance,
                    manualFees: manualFees ?? 0,
                    description,
                }
            })
        }}
    >
        {children}
        <p>Totalt for oppholdet: {displayAmount(funds)}</p>
    </LedgerTransactionModal>
}
