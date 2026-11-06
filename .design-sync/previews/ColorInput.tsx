import { ColorInput } from '@ohma/ui'

/**
 * Dressed as a form field like the other inputs: the swatch takes the place of
 * the field value, with the selected hex beside it and the label floated above.
 */
export const Default = () => (
    <div style={{ maxWidth: '22rem' }}>
        <ColorInput name="groupColor" label="Komitéfarge" defaultValue="#037FFC" />
    </div>
)

export const FromRGB = () => (
    <div style={{ maxWidth: '22rem' }}>
        <ColorInput name="accent" label="Aksentfarge" defaultValueRGB={{ red: 92, green: 209, blue: 122 }} />
    </div>
)

export const Palette = () => (
    <div style={{ display: 'grid', gap: '0.75rem', maxWidth: '22rem' }}>
        <ColorInput name="primary" label="Primær" defaultValue="#037FFC" />
        <ColorInput name="warning" label="Advarsel" defaultValue="#E6E64D" />
        <ColorInput name="danger" label="Fare" defaultValue="#EB5757" />
    </div>
)

export const OnRaisedSurface = () => (
    <div style={{
        background: 'var(--color-base-200)',
        padding: '1.5rem',
        borderRadius: 'var(--rounding)',
        maxWidth: '22rem',
    }}>
        <ColorInput name="flairColor" label="Flair-farge" background="raised" defaultValue="#A855F7" />
    </div>
)
