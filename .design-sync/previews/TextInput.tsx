import { TextInput } from '@ohma/ui'

export const Default = () => (
    <div style={{ maxWidth: '22rem' }}>
        <TextInput name="fullName" label="Fullt navn" defaultValue="Ola Nordmann" />
    </div>
)

/**
 * `color` sets the *typed text* colour, not the field chrome — so each variant
 * needs a value to show anything. (`secondary` maps to --surface-base, which is
 * near-invisible on the dark field; see NOTES.md.)
 */
export const Colors = () => (
    <div style={{ display: 'grid', gap: '1.5rem', maxWidth: '22rem' }}>
        <TextInput name="base" label="base (default)" color="base" defaultValue="Standard tekst" />
        <TextInput name="primary" label="Primary" color="primary" defaultValue="Primary tekst" />
        <TextInput name="secondary" label="secondary" color="secondary" defaultValue="Secondary tekst" />
        <TextInput name="error" label="error" color="error" defaultValue="Feil i feltet" />
    </div>
)

export const Password = () => (
    <div style={{ maxWidth: '22rem' }}>
        <TextInput name="password" label="Passord" type="password" defaultValue="hemmelig" />
    </div>
)

export const OnRaisedSurface = () => (
    <div style={{
        background: 'var(--surface-raised)',
        padding: '1.5rem',
        borderRadius: 'var(--rounding)',
        maxWidth: '22rem',
    }}>
        <TextInput name="email" label="E-post" background="base200" defaultValue="omega@omega.ntnu.no" />
    </div>
)

export const Disabled = () => (
    <div style={{ maxWidth: '22rem' }}>
        <TextInput name="username" label="Brukernavn" defaultValue="olanord" disabled />
    </div>
)
