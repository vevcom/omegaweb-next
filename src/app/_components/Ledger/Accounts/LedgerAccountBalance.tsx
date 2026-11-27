import { displayAmount } from '@/lib/currency/convert'
import { currencySymbol } from '@/lib/currency/config'
import type { Balance } from '@/services/ledger/accounts/types'

const currencyClassName = `
    text-left text-base-content/80
    max-mobile:hidden
`

type Props = {
    balance: Balance,
    showFees?: boolean,
}

export default function LedgerAccountBalance({ balance, showFees }: Props) {
    return <div className="
        grid grid-cols-[auto_1fr_auto] grid-flow-row auto-cols-max items-baseline gap-x-4 whitespace-nowrap
        overflow-hidden
        max-mobile:grid-cols-[auto_1fr]
    ">
        <div className="contents text-xxl">
            <div className="text-base-content">Saldo</div>
            <div className="text-right text-base-content">{displayAmount(balance.amount)}</div>
            <div className={`
                ${currencyClassName}
                text-l
            `}>{currencySymbol}</div>
        </div>
        {showFees && <div className="contents text-l">
            <div className="text-base-content">Avgifter</div>
            <div className="text-right text-base-content">{displayAmount(balance.fees)}</div>
            {/* Scaled from the balance's currency by text-l / text-xxl, which is about a half. */}
            <div className={`
                ${currencyClassName}
                text-[calc(var(--text-l)*0.5)]
            `}>{currencySymbol}</div>
        </div>}
    </div>
}
