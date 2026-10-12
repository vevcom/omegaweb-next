'use client'
import styles from './LedgerTransactionDetails.module.scss'
import { displayAmount } from '@/lib/currency/convert'
import { displayDate } from '@/lib/dates/displayDate'
import { Require } from '@/auth/authorizer/Require'
import useAuthorizer from '@/hooks/useAuthorizer'
import type { ExpandedLedgerTransaction } from '@/services/ledger/transactions/types'
import type { LedgerTransactionPurpose, LedgerTransactionState, PaymentProvider } from '@/prisma-generated-pn-types'
import type { ReactNode } from 'react'

type Props = {
    transaction: ExpandedLedgerTransaction,
    accountId: number,
}

export const transactionPurposeNames: Record<LedgerTransactionPurpose, string> = {
    SHOP_PURCHASE: 'Kjøp i Kiogeskabet',
    EVENT_PAYMENT: 'Arrangementsbetaling',
    CABIN_BOOKING: 'Hyttebooking',
    DEPOSIT: 'Innskudd',
    PAYOUT: 'Utbetaling',
    REFUND: 'Refusjon',
}

export const transactionStateNames: Record<LedgerTransactionState, string> = {
    PENDING: 'Under behandling',
    SUCCEEDED: 'Fullført',
    FAILED: 'Feilet',
    CANCELED: 'Avbrutt',
}

const paymentProviderNames: Record<PaymentProvider, string> = {
    STRIPE: 'Bankkort',
    MANUAL: 'Manuell overføring',
}

function DetailRow({ label, value }: { label: string, value: ReactNode }) {
    return <div className={styles.detailRow}>
        <span className={styles.label}>{label}</span>
        <span>{value}</span>
    </div>
}

export default function LedgerTransactionDetails({ transaction, accountId }: Props) {
    const canViewFees = useAuthorizer({ authorizer: Require.permission('LEDGER_ADMIN') }).authorized
    const totalFunds = (
        transaction.ledgerEntries.reduce((sum, entry) => sum + Math.abs(entry.funds), 0)
        + Math.abs(transaction.payment?.funds ?? 0)
    ) / 2

    const accountEntry = transaction.ledgerEntries.find(entry => entry.ledgerAccountId === accountId)

    return <div className={styles.details}>
        <h3>{transactionPurposeNames[transaction.purpose]}</h3>

        <DetailRow label="Dato" value={displayDate(transaction.createdAt)} />
        <DetailRow label="Status" value={transactionStateNames[transaction.state]} />
        <DetailRow label="Beløp" value={displayAmount(totalFunds, false)} />
        {accountEntry && <DetailRow label="Saldoendring" value={displayAmount(accountEntry.funds, false, true)} />}
        {canViewFees && accountEntry?.fees !== null && accountEntry?.fees !== undefined && (
            <DetailRow label="Gebyrendring" value={displayAmount(accountEntry.fees, false, true)} />
        )}
        {transaction.description && <DetailRow label="Beskrivelse" value={transaction.description} />}
        {transaction.reason && <DetailRow label="Årsak" value={transaction.reason} />}
        {transaction.payment && (
            <DetailRow
                label="Betalingsmetode"
                value={
                    transaction.payment.manualPayment?.bankAccountNumber
                        ? `${paymentProviderNames[transaction.payment.provider]} `
                            + `(${transaction.payment.manualPayment.bankAccountNumber})`
                        : paymentProviderNames[transaction.payment.provider]
                }
            />
        )}

        {transaction.purpose === 'CABIN_BOOKING' && transaction.booking && (
            <div className={styles.section}>
                <h4>Hyttebooking</h4>
                <DetailRow
                    label="Periode"
                    value={
                        `${displayDate(transaction.booking.start, false)} `
                        + `– ${displayDate(transaction.booking.end, false)}`
                    }
                />
                <DetailRow label="Medlemmer" value={transaction.booking.numberOfMembers} />
                <DetailRow label="Ikke-medlemmer" value={transaction.booking.numberOfNonMembers} />
                <DetailRow label="Pris" value={displayAmount(transaction.booking.totalPrice, false)} />
                {transaction.booking.event && <DetailRow label="Arrangement" value={transaction.booking.event.name} />}
            </div>
        )}

        {transaction.purpose === 'EVENT_PAYMENT' && transaction.eventRegistration && (
            <div className={styles.section}>
                <h4>Arrangement</h4>
                <DetailRow label="Navn" value={transaction.eventRegistration.event.name} />
                {transaction.eventRegistration.event.location && (
                    <DetailRow label="Sted" value={transaction.eventRegistration.event.location} />
                )}
                <DetailRow
                    label="Tidspunkt"
                    value={
                        `${displayDate(transaction.eventRegistration.event.eventStart)} `
                        + `– ${displayDate(transaction.eventRegistration.event.eventEnd)}`
                    }
                />
            </div>
        )}

        {transaction.purpose === 'SHOP_PURCHASE' && transaction.purchase && (
            <div className={styles.section}>
                <h4>Kjøp</h4>
                <DetailRow label="Butikk" value={transaction.purchase.shop.name} />
                <ul className={styles.productList}>
                    {transaction.purchase.PurchaseProduct.map(purchaseProduct => (
                        <li key={purchaseProduct.productId}>
                            {purchaseProduct.quantity}x {purchaseProduct.product.name} — {
                                displayAmount(purchaseProduct.price * purchaseProduct.quantity, false)
                            }
                        </li>
                    ))}
                </ul>
            </div>
        )}
    </div>
}
