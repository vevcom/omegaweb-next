'use client'

import { MINIMUM_PAYMENT_AMOUNT } from '@/services/ledger/payments/constants'
import { Elements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import type { ReactNode } from 'react'

if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    console.error('Stripe publishable key er ikke satt. Betaling vil ikke fungere.')
}

const stripe = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
    : null

type Props = {
    children?: ReactNode,
    mode: 'payment' | 'setup',
    amount?: number,
    customerSessionClientSecret?: string,
}

export default function StripeProvider({ children, mode, amount, customerSessionClientSecret }: Props) {
    return (
        <Elements stripe={stripe} options={{
            mode,
            currency: 'nok',
            amount: amount ? Math.max(MINIMUM_PAYMENT_AMOUNT, amount) : undefined,
            customerSessionClientSecret,
        }}>
            {children}
        </Elements>
    )
}
