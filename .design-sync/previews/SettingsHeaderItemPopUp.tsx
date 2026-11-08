import { SettingsHeaderItemPopUp, Button, TextInput } from '@ohma/ui'
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

/** The panel only opens from a real press on the trigger, so drive that on mount. */
function OpenOnMount({ children }: { children: ReactNode }) {
    const ref = useRef<HTMLDivElement>(null)
    useEffect(() => {
        ref.current?.querySelector<HTMLButtonElement>('button')?.click()
    }, [])
    return <div ref={ref}>{children}</div>
}

const panel = (
    <div style={{ display: 'grid', gap: '1rem', minWidth: '17rem' }}>
        <h2 style={{ margin: 0 }}>Innstillinger for siden</h2>
        <TextInput name="pageTitle" label="Sidetittel" background="base200" defaultValue="Arrangementer" />
        <Button color="primary">Lagre</Button>
    </div>
)

export const Trigger = () => (
    <SettingsHeaderItemPopUp popUpKey="settings-trigger">{panel}</SettingsHeaderItemPopUp>
)

export const Opened = () => (
    <OpenOnMount>
        <SettingsHeaderItemPopUp popUpKey="settings-opened">{panel}</SettingsHeaderItemPopUp>
    </OpenOnMount>
)

export const CustomLabel = () => (
    <SettingsHeaderItemPopUp popUpKey="settings-label" label="Innstillinger">{panel}</SettingsHeaderItemPopUp>
)
