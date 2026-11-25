'use client'
import Form from '@/components/Form/Form'
import { cancelCabinBookingAction } from '@/services/cabin/booking/actions'
import { configureAction } from '@/services/configureAction'

export default function CancelCabinBookingForm({ bookingId }: { bookingId: number }) {
    return <Form
        action={configureAction(cancelCabinBookingAction, { params: { bookingId } })}
        submitText="Avbestill"
        submitColor="red"
        confirmation={{
            confirm: true,
            text: 'Vil du avbestille? Hele beløpet settes inn på Omega-kontoen din.',
        }}
        refreshOnSuccess
    />
}
