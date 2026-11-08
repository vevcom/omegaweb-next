import { AddHeaderItemPopUp, Button, TextInput } from '@ohma/ui'
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
        <h2 style={{ margin: 0 }}>Nytt arrangement</h2>
        <TextInput name="eventName" label="Navn" background="base200" />
        <Button color="primary">Opprett</Button>
    </div>
)

export const Trigger = () => (
    <AddHeaderItemPopUp popUpKey="add-trigger">{panel}</AddHeaderItemPopUp>
)

export const Opened = () => (
    <OpenOnMount>
        <AddHeaderItemPopUp popUpKey="add-opened">{panel}</AddHeaderItemPopUp>
    </OpenOnMount>
)

export const CustomLabel = () => (
    <AddHeaderItemPopUp popUpKey="add-label" label="Ny">{panel}</AddHeaderItemPopUp>
)
