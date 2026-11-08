import { HelpHeaderItemPopUp } from '@ohma/ui'
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
        <h2 style={{ margin: 0 }}>Hjelp</h2>
        <p style={{ margin: 0, color: 'var(--color-base-content)' }}>
            Trykk på pluss-ikonet for å legge til et nytt arrangement. Endringer lagres først når du trykker Opprett.
        </p>
    </div>
)

export const Trigger = () => (
    <HelpHeaderItemPopUp popUpKey="help-trigger">{panel}</HelpHeaderItemPopUp>
)

export const Opened = () => (
    <OpenOnMount>
        <HelpHeaderItemPopUp popUpKey="help-opened">{panel}</HelpHeaderItemPopUp>
    </OpenOnMount>
)

export const CustomLabel = () => (
    <HelpHeaderItemPopUp popUpKey="help-label" label="Hjelp">{panel}</HelpHeaderItemPopUp>
)
