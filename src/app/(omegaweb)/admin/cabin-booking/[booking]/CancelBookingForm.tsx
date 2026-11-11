'use client'
import Form from '@/components/Form/Form'
import Checkbox from '@/components/UI/Checkbox'
import { cancelCabinBookingAsAdminAction } from '@/services/cabin/booking/actions'
import { configureAction } from '@/services/configureAction'

export default function CancelBookingForm({ bookingId, paid, guest }: {
    bookingId: number,
    paid: boolean,
    guest: boolean,
}) {
    return <Form
        action={configureAction(cancelCabinBookingAsAdminAction, { params: { bookingId } })}
        submitText="Avbestill"
        submitColor="red"
        confirmation={{ confirm: true, text: 'Vil du avbestille bookingen? Datoene blir ledige igjen.' }}
        refreshOnSuccess
    >
        {paid && <>
            <Checkbox name="refund" label="Refunder hele beløpet" defaultChecked />
            <p className="m-0 text-s text-base-content/80">
                {guest
                    ? 'Gjesten har ingen Omega-konto, så refusjonen legges i køen for manuell gjennomgang '
                        + 'og må gjøres i Stripe.'
                    : 'Beløpet settes inn på leietakerens Omega-konto.'}
            </p>
        </>}
    </Form>
}
