import { SocialIcons } from '@ohma/ui'

/**
 * SocialIcons renders three fixed brand links (X, Facebook, Instagram) as a
 * fragment, so the caller owns the layout — it takes no props.
 */
export const Default = () => (
    <div style={{ display: 'flex', gap: '1.25rem', fontSize: '1.5rem' }}>
        <SocialIcons />
    </div>
)

export const InFooterRow = () => (
    <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '2rem',
        padding: '1.25rem',
        background: 'var(--color-base-200)',
        borderRadius: 'var(--rounding)',
    }}>
        <span style={{ color: 'var(--color-base-content)' }}>Sanctus Omega Broderskab</span>
        <div style={{ display: 'flex', gap: '1.25rem', fontSize: '1.35rem' }}>
            <SocialIcons />
        </div>
    </div>
)

export const Stacked = () => (
    <div style={{ display: 'grid', gap: '1rem', fontSize: '1.25rem', justifyItems: 'start' }}>
        <SocialIcons />
    </div>
)
