import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import React, { useImperativeHandle } from 'react'

export type StripePaymentRef = {
    submit: () => Promise<string | null>;
    confirmPayment: (clientSecret: string) => Promise<string | null>;
    confirmSetup: (clientSecret: string) => Promise<string | null>;
}

type Props = {
    ref?: React.Ref<StripePaymentRef>,
}

export default function StripePayment({ ref }: Props) {
    const stripe = useStripe()
    const elements = useElements()

    useImperativeHandle(ref, () => ({
        submit: async () => {
            if (!stripe || !elements) return 'Stripe er ikke initalisert enda.'

            const { error } = await elements.submit()

            if (error) return error.message || 'En feil oppsto når betalingen skulle sendes inn.'

            return null
        },
        confirmPayment: async (clientSecret: string) => {
            if (!stripe || !elements) return 'Stripe ikke initialisert enda.'

            const { error } = await stripe.confirmPayment({
                clientSecret,
                elements,
                confirmParams: {
                    return_url: window.location.href,
                },
                // Cards are confirmed without leaving the page, so the caller can wait for the
                // payment to be recorded before refreshing.
                redirect: 'if_required',
            })

            if (error) return error.message || 'En feil oppsto når betalingen skulle bekreftes.'

            return null
        },
        confirmSetup: async (clientSecret: string) => {
            if (!stripe || !elements) return 'Stripe ikke initialisert enda.'

            const { error } = await stripe.confirmSetup({
                clientSecret,
                elements,
                confirmParams: {
                    return_url: window.location.href,
                },
            })

            if (error) return error.message || 'En feil oppsto ved lagring av informasjon.'

            return null
        }
    }))

    return <PaymentElement />
}
