'use client'
import { removeBrowserPushSubscription } from '@/components/PushNotifications/browserPushSubscription'
import useDomainContext from '@/hooks/useDomainContext'
import { signOut } from 'next-auth/react'
import { useEffect, useRef } from 'react'
import type { AppHref } from '@/lib/sites/href'

/** Logs out on arrival and sends the browser on to `callbackUrl`, an app path, on the domain it is on. */
export default function LogOut({ callbackUrl: callbackAppPath }: { callbackUrl: AppHref }) {
    const loggingOut = useRef(false)
    const callbackUrl = useDomainContext().resolveHref(callbackAppPath)

    useEffect(() => {
        if (loggingOut.current) return
        loggingOut.current = true

        void removeBrowserPushSubscription()
            .catch(() => undefined)
            .finally(() => signOut({
                redirect: true,
                callbackUrl,
            }))
    }, [callbackUrl])

    return <>Logger ut...</>
}
