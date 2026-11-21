'use client'
import { removeBrowserPushSubscription } from '@/components/PushNotifications/browserPushSubscription'
import { prepareChatSignOut } from '@/components/Chat/Session/prepareChatSignOut'
import { chatLinks } from '@/app/(omegaweb)/chat/links'
import { useSession } from '@/auth/session/useSession'
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
 *
 * A browser that holds a session with the chat is signed out of it before any of that, while the
 * user is still known. This page cannot reach the chat, by its content security policy, so the
 * browser goes by a chat page that can, which sends it back here. Nothing of that can keep the
 * user from being logged out.
 */
export default function LogOut({ callbackUrl: callbackAppPath }: { callbackUrl: AppHref }) {
    const loggingOut = useRef(false)
    const here = useDomainContext()
    const callbackUrl = here.resolveHref(callbackAppPath)
    const chatSignOutPage = here.resolveHref(chatLinks.signOut(here.path))
    const session = useSession()

    useEffect(() => {
        if (session.loading || loggingOut.current) return
        loggingOut.current = true
        const { user } = session.session

        const logOut = () => removeBrowserPushSubscription()
            .catch(() => undefined)
            .then(() => signOut({ redirect: false }))
            .finally(() => {
                const endSession = new URL(oidcPaths.endSession, DomainContext.authOrigin())
                endSession.searchParams.set('post_logout_redirect_uri', new URL(callbackUrl, window.location.origin).href)
                window.location.href = endSession.href
            })

        void prepareChatSignOut(user?.id ?? null).catch(() => false).then(goesByTheChat => {
            if (goesByTheChat) window.location.replace(chatSignOutPage)
            else void logOut()
        })
    }, [callbackUrl, chatSignOutPage, session])

    return <>Logger ut...</>
}
