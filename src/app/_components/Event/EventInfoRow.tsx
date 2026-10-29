import type { ReactNode } from 'react'

/** A label and its value, as one row of a section of the event sidebar. */
export default function EventInfoRow({ label, children }: { label: string, children: ReactNode }) {
    return <p className="m-0 flex justify-between gap-4 text-m">
        <span className="text-text-muted">{label}</span>
        <span className="text-right tabular-nums">{children}</span>
    </p>
}
