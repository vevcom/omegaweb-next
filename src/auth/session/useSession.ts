'use client'
import { Session } from './Session'
import { useDefaultPermissions } from '@/contexts/ClientData'
import { useSession as useSessionNextAuth } from 'next-auth/react'
import type { AnySession } from './Session'

export { SessionProvider } from 'next-auth/react'

type UseSessionReturn = { loading: true } | { loading: false, session: AnySession }

export function useSession(): UseSessionReturn {
    // Default permissions are seeded into ClientData by layout, so this resolves synchronously.
    const defaultPermissionsResult = useDefaultPermissions()
    const defaultPermissions =
        defaultPermissionsResult.status === 'success' ? defaultPermissionsResult.defaultPermissions : []

    const { data: session, status: nextAuthStatus } = useSessionNextAuth()
    switch (nextAuthStatus) {
        case 'loading':
            return { loading: true }
        case 'unauthenticated':
            return { loading: false, session: Session.fromDefaultPermissions(defaultPermissions) }
        case 'authenticated':
            return { loading: false, session: Session.fromToken(session) }
        default:
            return { loading: false, session: Session.fromDefaultPermissions(defaultPermissions) }
    }
}
