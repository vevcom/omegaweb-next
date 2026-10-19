'use client'

import { removeBrowserPushSubscription } from '@/components/PushNotifications/browserPushSubscription'
import { signOut } from 'next-auth/react'
import { useEffect, useRef } from 'react'

export default function LogOut() {
    const loggingOut = useRef(false)

    useEffect(() => {
        if (loggingOut.current) return
        loggingOut.current = true

        removeBrowserPushSubscription()
            .catch(() => undefined)
            .finally(() => signOut({
                redirect: true,
                callbackUrl: '/'
            }))
    }, [])

    return <>Logger ut...</>
}
