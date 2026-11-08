import { CountDown } from '@ohma/ui'

// CountDown ticks every 100ms off the real clock, so the reference has to be
// relative to "now" for the cards to show a meaningful remainder.
const inDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000)
const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60 * 1000)

export const Days = () => (
    <p style={{ margin: 0, fontSize: '1.5rem' }}>
        <CountDown referenceDate={inDays(12)} />
    </p>
)

export const HoursAndMinutes = () => (
    <p style={{ margin: 0, fontSize: '1.5rem' }}>
        <CountDown referenceDate={inMinutes(150)} />
    </p>
)

export const InHeroPanel = () => (
    <div style={{
        background: 'var(--color-base-200)',
        padding: '1.5rem',
        borderRadius: 'var(--cardRounding, var(--rounding))',
        textAlign: 'center',
        display: 'grid',
        gap: '0.5rem',
    }}>
        <span style={{ color: 'var(--color-base-content)' }}>Immatrikuleringsballet starter om</span>
        <strong style={{ fontSize: '1.75rem' }}>
            <CountDown referenceDate={inDays(3)} />
        </strong>
    </div>
)
