import { SelectString } from '@ohma/ui'

const committees = [
    { value: 'vevkom', label: 'Vevkom', key: 'vevkom' },
    { value: 'arrkom', label: 'Arrkom', key: 'arrkom' },
    { value: 'kjellerkom', label: 'Kjellerkom', key: 'kjellerkom' },
    { value: 'redaksjonen', label: 'Redaksjonen', key: 'redaksjonen' },
]

/**
 * A native `<select>` styled as a form field. Because a select always has a
 * selection, the label sits permanently in the floated position rather than
 * toggling the way TextInput's does.
 */
export const Default = () => (
    <div style={{ maxWidth: '22rem' }}>
        <SelectString name="committee" label="Komité" defaultValue="arrkom" options={committees} />
    </div>
)

export const Colors = () => (
    <div style={{ display: 'grid', gap: '1rem', maxWidth: '22rem' }}>
        <SelectString name="base" label="base (default)" color="base" options={committees} />
        <SelectString name="primary" label="Primary" color="primary" options={committees} />
        <SelectString name="secondary" label="secondary" color="secondary" options={committees} />
        <SelectString name="error" label="Error" color="error" options={committees} />
    </div>
)

export const LabelFromValue = () => (
    <div style={{ maxWidth: '22rem' }}>
        <SelectString
            name="status"
            label="Status"
            options={[
                { value: 'Aktiv', key: 'aktiv' },
                { value: 'Permisjon', key: 'permisjon' },
                { value: 'Utflyttet', key: 'utflyttet' },
            ]}
        />
    </div>
)

export const OnRaisedSurface = () => (
    <div style={{
        background: 'var(--surface-raised)',
        padding: '1.5rem',
        borderRadius: 'var(--rounding)',
        maxWidth: '22rem',
    }}>
        <SelectString name="committeeRaised" label="Komité" background="base100" options={committees} />
    </div>
)

export const Disabled = () => (
    <div style={{ maxWidth: '22rem' }}>
        <SelectString
            name="locked"
            label="Opptaksår"
            defaultValue="2021"
            disabled
            options={[{ value: '2021', key: '2021' }, { value: '2022', key: '2022' }]}
        />
    </div>
)
