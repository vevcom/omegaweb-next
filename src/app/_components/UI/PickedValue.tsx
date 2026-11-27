import type { ReactNode } from 'react'

type PropTypes = {
    label: string,
    /** What is picked, or null for nothing. */
    value: string | null,
    /** What is shown while nothing is picked. */
    empty: string,
    /** Marks that something must be picked. */
    missing?: boolean,
    /** The buttons that pick another or take it away. */
    actions?: ReactNode,
    /** The input the field posts the value with, which is its own. */
    children?: ReactNode,
}

/** A value picked in a list elsewhere, as a field of a form shows it. */
export default function PickedValue({ label, value, empty, missing = false, actions, children }: PropTypes) {
    return (
        <div
            className={`
                flex flex-col gap-1 w-full py-2 px-4 border-2 rounded-inner bg-base-200
                ${missing ? 'border-[color-mix(in_srgb,var(--color-warning),transparent_60%)]' : 'border-transparent'}
            `}
        >
            <span className="text-[length:calc(var(--text-s)*0.85)] text-base-content/80">{label}</span>
            <span className={`
                text-m leading-[calc(var(--text-m)*1.25)] truncate
                ${value ? 'text-base-content' : 'text-base-content/80 italic'}
            `}>{value ?? empty}</span>
            {actions && <div className="flex gap-4">{actions}</div>}
            {children}
        </div>
    )
}
