'use client'

import PopUp from '@/components/PopUp/PopUp'
import Button from '@/components/UI/Button'
import Form from '@/components/Form/Form'
import StripePayment from '@/components/Stripe/StripePayment'
import StripeProvider from '@/components/Stripe/StripeProvider'
import { createActionError } from '@/services/actionError'
import { createSetupIntentAction } from '@/services/stripeCustomers/actions'
import { stripeCustomerAuth } from '@/services/stripeCustomers/auth'
import useAuthorizer from '@/hooks/useAuthorizer'
import { useRef } from 'react'
import type { StripePaymentRef } from '@/components/Stripe/StripePayment'

type PropTypes = {
    userId: number,
}

export default function PaymentMethodModal({ userId }: PropTypes) {
    const stripePaymentRef = useRef<StripePaymentRef>(null)
    const canAddPaymentMethod = useAuthorizer({ authorizer: stripeCustomerAuth.createSetupIntent.data({ userId }) })
        .authorized

    const handleSubmit = async () => {
        if (!stripePaymentRef.current) {
            return createActionError('UNKNOWN ERROR', 'Noe gikk galt da Stripe skulle lastes inn.')
        }

        const submitError = await stripePaymentRef.current.submit()

        if (submitError) return createActionError('BAD DATA', submitError)

        const createSetupIntentResult = await createSetupIntentAction({ params: { userId } })

        if (!createSetupIntentResult.success) return createSetupIntentResult

        const setupError = await stripePaymentRef.current.confirmSetup(createSetupIntentResult.data.setupIntentClientSecret)

        if (setupError) return createActionError('UNKNOWN ERROR', setupError)

        return {
            success: true,
            data: undefined,
        } as const
    }

    if (!canAddPaymentMethod) return null

    return (
        <PopUp
            popUpKey="PaymentMethodModal"
            customShowButton={(open) => <Button onClick={open} className="self-start">Legg til bankkort</Button>}
        >
            <h3>Legg til bankkort</h3>
            <div className="w-[min(500px,calc(100svw-3rem))]">
                <Form action={handleSubmit} submitText="Legg til bankkort">
                    <StripeProvider mode="setup">
                        <StripePayment ref={stripePaymentRef} />
                    </StripeProvider>
                </Form>
            </div>
        </PopUp>
    )
}
