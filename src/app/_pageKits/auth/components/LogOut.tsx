'use client'
import { removeBrowserPushSubscription } from '@/components/PushNotifications/browserPushSubscription'
import useDomainContext from '@/hooks/useDomainContext'
import { DomainContext } from '@/lib/sites/context'
import { oidcPaths } from '@/services/auth/oidc/constants'
import { signOut } from 'next-auth/react'
import { useEffect, useRef } from 'react'
import type { AppHref } from '@/lib/sites/href'

/**
 * Logs out on arrival and sends the browser on to `callbackUrl`, an app path, on the domain it is
 * on. The session here ends first, then the one on the auth domain, which would otherwise sign the
 * visitor straight back in at the next login; the auth domain sends the browser on.
 */
export default function LogOut({ callbackUrl: callbackAppPath }: { callbackUrl: AppHref }) {
    const loggingOut = useRef(false)
    const callbackUrl = useDomainContext().resolveHref(callbackAppPath)

    useEffect(() => {
        if (loggingOut.current) return
        loggingOut.current = true

        void removeBrowserPushSubscription()
            .catch(() => undefined)
            .then(() => signOut({ redirect: false }))
            .finally(() => {
                const endSession = new URL(oidcPaths.endSession, DomainContext.authOrigin())
                endSession.searchParams.set('post_logout_redirect_uri', new URL(callbackUrl, window.location.origin).href)
                window.location.href = endSession.href
            })
    }, [callbackUrl])

    return <>Logger ut...</>
}
