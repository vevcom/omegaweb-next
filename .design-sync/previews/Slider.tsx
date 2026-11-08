import { Slider } from '@ohma/ui'

export const Default = () => (
    <Slider name="public" label="Vis profilen offentlig" />
)

export const On = () => (
    <Slider name="notifications" label="Varsle meg om nye arrangementer" defaultChecked />
)

/**
 * `secondary` and `black` are deliberately omitted: they map the track to
 * --base-100, which is invisible against the app's own surface.
 * See NOTES.md.
 */
export const Colors = () => (
    <div style={{ display: 'grid', gap: '1rem' }}>
        <Slider name="primary" label="Primary" color="primary" defaultChecked />
        <Slider name="red" label="Red" color="red" defaultChecked />
        <Slider name="white" label="White" color="white" defaultChecked />
    </div>
)

export const SettingsList = () => (
    <div style={{ display: 'grid', gap: '0.5rem', maxWidth: '24rem' }}>
        <Slider name="mailAliases" label="Motta e-post til alias" defaultChecked />
        <Slider name="showBirthday" label="Vis fødselsdag" />
        <Slider name="omegaquotes" label="Tillat sitater om meg" defaultChecked />
    </div>
)
