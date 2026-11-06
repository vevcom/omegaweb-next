import { EditOverlay } from '@ohma/ui'

/**
 * EditOverlay is absolutely positioned and fills its nearest positioned
 * ancestor, so it is only meaningful on top of the CMS element it edits.
 */
export const OverCmsParagraph = () => (
    <div style={{ position: 'relative', maxWidth: '28rem' }}>
        <div style={{
            background: 'var(--color-base-200)',
            padding: '1.25rem',
            borderRadius: 'var(--rounding)',
        }}>
            <h3 style={{ margin: '0 0 0.5rem' }}>Hvad der hender</h3>
            <p style={{ margin: 0, color: 'var(--color-base-content)' }}>
                Denne teksten kommer fra CMS-et og kan redigeres i redigeringsmodus.
            </p>
        </div>
        <EditOverlay />
    </div>
)

export const OverImage = () => (
    <div style={{ position: 'relative', width: '14rem', height: '9rem' }}>
        <div style={{
            width: '100%',
            height: '100%',
            borderRadius: 'var(--rounding)',
            background: 'linear-gradient(135deg, var(--color-secondary), var(--color-primary))',
        }} />
        <EditOverlay />
    </div>
)
