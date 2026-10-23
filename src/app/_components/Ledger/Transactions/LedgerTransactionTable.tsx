import type { ReactNode } from 'react'

export const emptyTransactionsText = 'Her var det tomt! Hva med å ta seg en tur innom Kiogeskapet?'

type Props = {
    children: ReactNode,
}

export default function LedgerTransactionTable({ children }: Props) {
    return <table className="ohma-table">
        <thead>
            <tr>
                <th>Dato</th>
                <th>Beskrivelse</th>
                <th>Status</th>
                <th>Beløp</th>
                <th>Saldoendring</th>
            </tr>
        </thead>
        <tbody>
            {children}
        </tbody>
    </table>
}
