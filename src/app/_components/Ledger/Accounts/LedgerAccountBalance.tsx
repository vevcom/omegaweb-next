import styles from './LedgerAccountBalance.module.scss'
import { displayAmount } from '@/lib/currency/convert'
import { currencySymbol } from '@/lib/currency/config'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { withPageSession } from '@/app/serverPage'

type Props = {
    ledgerAccountId: number,
    showFees?: boolean,
}

export default async function LedgerAccountBalance({ ledgerAccountId: accountId, showFees }: Props) {
    const balance = await withPageSession(
        () => ledgerAccountOperations.calculateBalance({ params: { ledgerAccountId: accountId } })
    )

    return <div className={styles.LedgerAccountBalance}>
        <div className={styles.amountRow}>
            <div>Saldo</div>
            <div className={styles.total}>{displayAmount(balance.amount)}</div>
            <div className={styles.currencySymbol}>{currencySymbol}</div>
        </div>
        {showFees && <div className={styles.feesRow}>
            <div>Avgifter</div>
            <div className={styles.total}>{displayAmount(balance.fees)}</div>
            <div className={styles.currencySymbol}>{currencySymbol}</div>
        </div>}
    </div>
}
