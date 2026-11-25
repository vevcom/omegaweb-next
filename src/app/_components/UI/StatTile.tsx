import type { ReactNode } from 'react'

/** One number worth knowing, with what it counts above it and a word of detail below. */
export default function StatTile({ label, value, detail }: { label: string, value: ReactNode, detail?: string }) {
    return <div className="flex flex-col gap-1 p-3 rounded-inner bg-base-200">
        <span className="text-s text-base-content/80">{label}</span>
        <span className="text-l font-bold">{value}</span>
        {detail && <span className="text-s text-base-content/80">{detail}</span>}
    </div>
}
