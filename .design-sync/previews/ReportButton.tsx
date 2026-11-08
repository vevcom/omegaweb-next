import { ReportButton } from '@ohma/ui'

/**
 * ReportButton is a fixed-purpose link to /report — it takes no props. The
 * shield icon inherits its size from the surrounding font-size.
 */
export const Default = () => <ReportButton />

export const InNavBarRow = () => (
    <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        padding: '0.75rem 1rem',
        background: 'var(--color-base-200)',
        borderRadius: 'var(--rounding)',
    }}>
        <strong>Omega</strong>
        <ReportButton />
    </div>
)
