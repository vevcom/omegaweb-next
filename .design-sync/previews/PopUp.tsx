import { PopUp, Button, TextInput } from '@ohma/ui'
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

/**
 * PopUp keeps `isOpen` in its own state and teleports the panel up to
 * PopUpProvider, so the open state can only be reached by pressing the trigger.
 * Clicking it on mount drives the real component rather than faking the panel.
 */
function OpenOnMount({ children }: { children: ReactNode }) {
    const ref = useRef<HTMLDivElement>(null)
    useEffect(() => {
        ref.current?.querySelector('button')?.click()
    }, [])
    return <div ref={ref}>{children}</div>
}

export const Trigger = () => (
    <PopUp popUpKey="trigger-demo" showButtonContent={<Button color="primary">Ny søknad</Button>}>
        <p>Innholdet i pop-upen.</p>
    </PopUp>
)

export const Opened = () => (
    <OpenOnMount>
        <PopUp popUpKey="opened-demo" showButtonContent={<Button color="primary">Rediger profil</Button>}>
            <div style={{ display: 'grid', gap: '1rem', minWidth: '18rem' }}>
                <h2 style={{ margin: 0 }}>Rediger profil</h2>
                <TextInput name="firstname" label="Fornavn" defaultValue="Ola" background="base200" />
                <TextInput name="lastname" label="Etternavn" defaultValue="Nordmann" background="base200" />
                <Button color="primary">Lagre</Button>
            </div>
        </PopUp>
    </OpenOnMount>
)
