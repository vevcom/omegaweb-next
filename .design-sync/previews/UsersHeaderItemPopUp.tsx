import { UsersHeaderItemPopUp, Button, TextInput } from '@ohma/ui'
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
        <h2 style={{ margin: 0 }}>Legg til medlemmer</h2>
        <TextInput name="memberSearch" label="Søk etter medlem" background="base200" />
        <Button color="primary">Legg til</Button>
    </div>
)

export const Trigger = () => (
    <UsersHeaderItemPopUp popUpKey="users-trigger">{panel}</UsersHeaderItemPopUp>
)

export const Opened = () => (
    <OpenOnMount>
        <UsersHeaderItemPopUp popUpKey="users-opened">{panel}</UsersHeaderItemPopUp>
    </OpenOnMount>
)

export const CustomLabel = () => (
    <UsersHeaderItemPopUp popUpKey="users-label" label="Medlemmer">{panel}</UsersHeaderItemPopUp>
)
