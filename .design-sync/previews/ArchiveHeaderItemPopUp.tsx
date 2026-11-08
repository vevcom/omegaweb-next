import { ArchiveHeaderItemPopUp, Button } from '@ohma/ui'
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
        <h2 style={{ margin: 0 }}>Arkiv</h2>
        <p style={{ margin: 0, color: 'var(--color-base-content)' }}>
            Arkiverte arrangementer vises ikke i oversikten, men beholdes.
        </p>
        <Button color="secondary">Vis arkiverte</Button>
    </div>
)

export const Trigger = () => (
    <ArchiveHeaderItemPopUp popUpKey="archive-trigger">{panel}</ArchiveHeaderItemPopUp>
)

export const Opened = () => (
    <OpenOnMount>
        <ArchiveHeaderItemPopUp popUpKey="archive-opened">{panel}</ArchiveHeaderItemPopUp>
    </OpenOnMount>
)

export const CustomLabel = () => (
    <ArchiveHeaderItemPopUp popUpKey="archive-label" label="Arkiv">{panel}</ArchiveHeaderItemPopUp>
)
