'use client'

import styles from './PaymentMethodList.module.scss'
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
                return <span className={styles.label}>
                    <span>{card?.brand?.toUpperCase()}</span>
                    <span>**** **** **** {card?.last4}</span>
                    <span>(utløper {card?.exp_month}/{card?.exp_year})</span>
                </span>
            default:
                return <span className={styles.label}>{type.toUpperCase()}</span>
        }
    }

    const removePaymentMethod = async (id: string) => {
        await deleteSavedPaymentMethodAction({ params: { userId, paymentMethodId: id } })
        router.refresh()
    }

    return (
        <ul>
            {paymentMethods.length > 0 ? paymentMethods.map((method) => (
                <li key={method.id} className={styles.paymentMethodElement}>
                    {displayPaymentMethod(method)}
                    {canDeletePaymentMethod &&
                        <button onClick={() => removePaymentMethod(method.id)} className={styles.deletePaymentMethodButton}>
                            <FontAwesomeIcon icon={faXmark}/>
                        </button>
                    }
                </li>
            )) : <li><em>Du har ingen lagrede betalingskort.</em></li>}
        </ul>
    )
}
