import { displayAmount } from '@/lib/currency/convert'
import { currencySymbol } from '@/lib/currency/config'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { withPageSession } from '@/app/ServerPage'

const currencyClassName = `
    text-left text-text-muted
    max-mobile:hidden
`

type Props = {
    ledgerAccountId: number,
    showFees?: boolean,
}

export default async function LedgerAccountBalance({ ledgerAccountId: accountId, showFees }: Props) {
    const balance = await withPageSession(
        () => ledgerAccountOperations.calculateBalance({ params: { ledgerAccountId: accountId } })
    )

    return <div className="
        grid grid-cols-[auto_1fr_auto] grid-flow-row auto-cols-max items-baseline gap-x-4 whitespace-nowrap
        overflow-hidden
        max-mobile:grid-cols-[auto_1fr]
    ">
        <div className="contents text-xxl">
            <div>Saldo</div>
            <div className="text-right">{displayAmount(balance.amount)}</div>
            <div className={`
                ${currencyClassName}
                text-l
            `}>{currencySymbol}</div>
        </div>
        {showFees && <div className="contents text-l">
            <div>Avgifter</div>
            <div className="text-right">{displayAmount(balance.fees)}</div>
            {/* Scaled from the balance's currency by text-l / text-xxl, which is about a half. */}
            <div className={`
                ${currencyClassName}
                text-[calc(var(--text-l)*0.5)]
            `}>{currencySymbol}</div>
        </div>}
    </div>
}
