import { NumberInput } from '@ohma/ui'

export const Default = () => (
    <div style={{ maxWidth: '22rem' }}>
        <NumberInput name="places" label="Antall plasser" defaultValue={120} />
    </div>
)

export const WithRange = () => (
    <div style={{ maxWidth: '22rem' }}>
        <NumberInput name="guests" label="Antall gjester" min={1} max={4} step={1} defaultValue={2} />
    </div>
)

export const OnRaisedSurface = () => (
    <div style={{ background: 'var(--color-base-200)', padding: '1.5rem', borderRadius: 'var(--rounding)' }}>
        <NumberInput name="price" label="Pris (kr)" background="raised" defaultValue={250} />
    </div>
)

export const Disabled = () => (
    <div style={{ maxWidth: '22rem' }}>
        <NumberInput name="capacity" label="Kapasitet" defaultValue={80} disabled />
    </div>
)
