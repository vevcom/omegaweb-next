import LedgerAccountBalance from './LedgerAccountBalance'
import LedgerAccountFreezeButton from './LedgerAccountFreezeButton'
import DepositModal from '@/components/Ledger/Modals/DepositModal'
import PayoutModal from '@/components/Ledger/Modals/PayoutModal'
import { createStripeCustomerSessionAction } from '@/services/stripeCustomers/actions'
import { ServerSession } from '@/auth/session/ServerSession'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faWarning } from '@fortawesome/free-solid-svg-icons'
import type { LedgerAccount } from '@/prisma-generated-pn-types'
import type { LedgerTransactionPaymentMethod } from '@/components/Ledger/Modals/LedgerTransactionModal'
import type { Capabilities } from '@/auth/authorizer/capabilities'

type Props = {
    ledgerAccount: LedgerAccount,
    showFees?: boolean,
    // Restricts the deposit methods offered. Used by the admin accounts page, where a Stripe
    // checkout would incorrectly charge the viewing admin's own card rather than the viewed
    // account's owner.
    depositPaymentMethods?: LedgerTransactionPaymentMethod[],
    capabilities: Capabilities<'canDeposit' | 'canPayout' | 'canFreeze'>,
}

const getCustomerSessionClientSecret = async () => {
    const { user } = await ServerSession.fromNextAuth()

    if (!user) {
        return undefined
    }

    const customerSessionResult = await createStripeCustomerSessionAction({ params: { userId: user.id } })
    if (!customerSessionResult.success) {
        return undefined
    }

    return customerSessionResult.data.customerSessionClientSecret
}

export default async function LedgerAccountOverview({
    showFees,
    ledgerAccount,
    depositPaymentMethods,
    capabilities,
}: Props) {
    const stripeAvailable = depositPaymentMethods === undefined || depositPaymentMethods.includes('STRIPE')
    const customerSessionClientSecret = capabilities.canDeposit.authorized && stripeAvailable
        ? await getCustomerSessionClientSecret()
        : undefined

    return <div className="bg-surface-base rounded-round p-[calc(3*var(--rounding))]">
        <h2>Kontooversikt</h2>
        <LedgerAccountBalance ledgerAccountId={ledgerAccount.id} showFees={showFees} />
        {
            ledgerAccount.frozen &&
            <p className="text-accent-red">
                <FontAwesomeIcon icon={faWarning}/> Kontoen er fryst; Ingen transaksjoner kan utføres.
            </p>
        }
        <div className="mt-6 flex flex-row">
            {
                capabilities.canDeposit.authorized &&
                <DepositModal
                    ledgerAccountId={ledgerAccount.id}
                    customerSessionClientSecret={customerSessionClientSecret}
                    availablePaymentMethods={depositPaymentMethods}
                />
            }
            { capabilities.canPayout.authorized && <PayoutModal ledgerAccountId={ledgerAccount.id} /> }
            {
                capabilities.canFreeze.authorized &&
                <LedgerAccountFreezeButton ledgerAccount={ledgerAccount} className="ml-auto" />
            }
        </div>
    </div>
}
