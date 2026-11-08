import { TagHeasderItemPopUp, Button, TextInput } from '@ohma/ui'
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
        <h2 style={{ margin: 0 }}>Merkelapper</h2>
        <TextInput name="tagName" label="Ny merkelapp" background="base200" />
        <Button color="green">Legg til merkelapp</Button>
    </div>
)

export const Trigger = () => (
    <TagHeasderItemPopUp popUpKey="tag-trigger">{panel}</TagHeasderItemPopUp>
)

export const Opened = () => (
    <OpenOnMount>
        <TagHeasderItemPopUp popUpKey="tag-opened">{panel}</TagHeasderItemPopUp>
    </OpenOnMount>
)

export const CustomLabel = () => (
    <TagHeasderItemPopUp popUpKey="tag-label" label="Merkelapper">{panel}</TagHeasderItemPopUp>
)
