import type { ReactNode } from 'react'

/** The frame of a card on a ledger account's page, which a card and its skeleton share. */
export default function LedgerAccountCard({ title, children }: { title: string, children: ReactNode }) {
    return <div className="bg-base-100 text-base-content rounded-round p-(--card-padding)">
        <h2 className="text-base-content">{title}</h2>
        {children}
    </div>
}
