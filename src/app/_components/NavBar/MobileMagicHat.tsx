'use client'

import useActiveNavHref from '@/hooks/useActiveNavHref'
import { useSession } from '@/auth/session/useSession'
import type { ReactNode } from 'react'

/** The mobile nav bar's profile button, highlighted on the login, logout and own profile pages. */
export default function MobileMagicHat({ children }: { children: ReactNode }) {
    const session = useSession()
    const user = session.loading ? null : session.session.user
    const active = useActiveNavHref([
        '/login',
        '/logout',
        ...(user ? [`/users/${user.username}`] : []),
    ]) !== undefined

    return <div className={`relative ${active ? '[--magic-hat-tint:var(--accent-blue)]' : ''}`}>{children}</div>
}
