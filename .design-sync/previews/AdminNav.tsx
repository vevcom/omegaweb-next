import { AdminNav } from '@ohma/ui'
import type { ReactNode } from 'react'

const Rail = ({ children }: { children: ReactNode }) => (
    <div style={{
        width: '4.5rem',
        padding: '0.75rem',
        background: 'var(--color-base-200)',
        borderRadius: 'var(--rounding)',
    }}>
        {children}
    </div>
)

/**
 * AdminNav renders nothing at all — not even its wrapping nav — unless
 * `isAdmin` is true or EditModeContext reports something editable on the page.
 *
 * Like SideBarNavItem, its icon labels stay collapsed unless an ancestor
 * matches `.DesktopSideBar[data-expanded='true']`; that shell is the app's own
 * DesktopSideBar server component and is not part of this design system, so
 * `expanded` has no visible effect here.
 */
export const Admin = () => (
    <Rail><AdminNav isAdmin /></Rail>
)

export const NonAdminRendersNothing = () => (
    <div>
        <p style={{ margin: '0 0 0.75rem', color: 'var(--color-base-content)' }}>
            <code>isAdmin=false</code> with nothing editable — AdminNav returns null:
        </p>
        <Rail><AdminNav isAdmin={false} /></Rail>
    </div>
)
