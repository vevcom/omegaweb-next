'use client'
import { removeBrowserPushSubscription } from '@/components/PushNotifications/browserPushSubscription'
import { signOut } from 'next-auth/react'
import { useEffect, useRef } from 'react'

export default function LogOut({ callbackUrl }: { callbackUrl: string }) {
    const loggingOut = useRef(false)

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
