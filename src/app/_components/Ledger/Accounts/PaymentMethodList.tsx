'use client'

import { deleteSavedPaymentMethodAction } from '@/services/stripeCustomers/actions'
import { stripeCustomerAuth } from '@/services/stripeCustomers/auth'
import useAuthorizer from '@/hooks/useAuthorizer'
import { faXmark } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useRouter } from 'next/navigation'
import type { FilteredPaymentMethod } from '@/services/stripeCustomers/types'

type Params = {
    userId: number,
    paymentMethods: FilteredPaymentMethod[],
}

export default function PaymentMethodList({ userId, paymentMethods }: Params) {
    const router = useRouter()
    const canDeletePaymentMethod = useAuthorizer({
        authorizer: stripeCustomerAuth.deleteSavedPaymentMethod.data({ userId }),
    }).authorized

    const displayPaymentMethod = ({ type, card }: FilteredPaymentMethod) => {
        switch (type) {
            case 'card':
                return <span className="flex flex-wrap gap-2">
                    <span>{card?.brand?.toUpperCase()}</span>
                    <span>**** **** **** {card?.last4}</span>
                    <span>(utløper {card?.exp_month}/{card?.exp_year})</span>
                </span>
            default:
                return <span className="flex flex-wrap gap-2">{type.toUpperCase()}</span>
        }
    }

    const removePaymentMethod = async (id: string) => {
        await deleteSavedPaymentMethodAction({ params: { userId, paymentMethodId: id } })
        router.refresh()
    }

    return (
        <ul className="list-none">
            {paymentMethods.length > 0 ? paymentMethods.map((method) => (
                <li key={method.id} className="
                    flex items-center justify-between gap-4 rounded-round border-2 border-solid border-surface-subtle my-2
                    p-4 text-l
                ">
                    {displayPaymentMethod(method)}
                    {canDeletePaymentMethod &&
                        <button onClick={() => removePaymentMethod(method.id)} className="
                            text-l text-text-muted justify-self-end size-[20px] bg-white border-none rounded-full
                            cursor-pointer transition-[background] duration-500 flex justify-center items-center
                            hover:bg-[color-mix(in_srgb,white,black_10%)]
                        ">
                            <FontAwesomeIcon icon={faXmark}/>
                        </button>
                    }
                </li>
            )) : <li><em>Du har ingen lagrede betalingskort.</em></li>}
        </ul>
    )
}
