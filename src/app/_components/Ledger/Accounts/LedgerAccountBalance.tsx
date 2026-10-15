import { displayAmount } from '@/lib/currency/convert'
import { currencySymbol } from '@/lib/currency/config'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { withPageSession } from '@/app/ServerPage'

type Props = {
    ledgerAccountId: number,
    showFees?: boolean,
}

export default async function LedgerAccountBalance({ ledgerAccountId: accountId, showFees }: Props) {
    const balance = await withPageSession(
        () => ledgerAccountOperations.calculateBalance({ params: { ledgerAccountId: accountId } })
    )

    return <div className={[
        'grid grid-cols-[auto_1fr_auto] grid-flow-row auto-cols-max gap-x-4 whitespace-nowrap overflow-hidden',
        'max-mobile:grid-cols-[auto_1fr]',
    ].join(' ')}>
        <div className="contents text-xxl">
            <div>Saldo</div>
            <div className="text-right">{displayAmount(balance.amount)}</div>
            <div className="text-text-muted text-m max-mobile:hidden">{currencySymbol}</div>
        </div>
        {showFees && <div className="contents text-l">
            <div>Avgifter</div>
            <div className="text-right">{displayAmount(balance.fees)}</div>
            <div className="text-text-muted text-m max-mobile:hidden">{currencySymbol}</div>
        </div>}
    </div>
}
