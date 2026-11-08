import { SlideInOnView } from '@ohma/ui'
import type { ReactNode } from 'react'

const Panel = ({ children }: { children: ReactNode }) => (
    <div style={{
        background: 'var(--color-base-200)',
        padding: '1.25rem',
        borderRadius: 'var(--rounding)',
    }}>
        {children}
    </div>
)

/**
 * Reveals its children when they scroll into view, via an IntersectionObserver
 * that adds the `visible` class. `direction` ('bottom' | 'left' | 'right' |
 * 'top') only changes the offset the content travels *from*, so once settled
 * every direction looks the same — the cards below therefore show the settled
 * state rather than one card per direction.
 */
export const Default = () => (
    <SlideInOnView>
        <Panel>Glir inn når seksjonen kommer i synsfeltet.</Panel>
    </SlideInOnView>
)

export const WithRichContent = () => (
    <SlideInOnView direction="left">
        <Panel>
            <h3 style={{ margin: '0 0 0.5rem' }}>Om Omega</h3>
            <p style={{ margin: 0, color: 'var(--color-base-content)' }}>
                Sanctus Omega Broderskab ble stiftet i Trondheim og samler studenter
                gjennom komitéer, arrangementer og tradisjoner.
            </p>
        </Panel>
    </SlideInOnView>
)

export const SeveralSections = () => (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
        <SlideInOnView direction="left"><Panel>Første seksjon</Panel></SlideInOnView>
        <SlideInOnView direction="right"><Panel>Andre seksjon</Panel></SlideInOnView>
        <SlideInOnView direction="bottom"><Panel>Tredje seksjon</Panel></SlideInOnView>
    </div>
)
