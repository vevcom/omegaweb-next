'use client'
import { removeBrowserPushSubscription } from '@/components/PushNotifications/browserPushSubscription'
import useSiteContext from '@/hooks/useSiteContext'
import { signOut } from 'next-auth/react'
import { useEffect, useRef } from 'react'

/** Logs out on arrival and sends the browser on to `callbackUrl`, an app path, on the domain it is on. */
export default function LogOut({ callbackUrl: callbackAppPath }: { callbackUrl: string }) {
    const loggingOut = useRef(false)
    const callbackUrl = useSiteContext().resolveHref(callbackAppPath)

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
