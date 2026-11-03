'use client'
import { signIn } from 'next-auth/react'
import { useEffect, useRef } from 'react'

type PropTypes = {
    /** The login another domain handed over, or null when it had none to give. */
    ticket: string | null,
    destination: string,
    /** Where to go instead when there is no login to take. */
    fallback: string,
}

/** Logs in with the ticket another domain handed over, then goes on. */
export default function SessionReceiver({ ticket, destination, fallback }: PropTypes) {
    const started = useRef(false)

    useEffect(() => {
        if (started.current) return
        started.current = true
        void (async () => {
            const result = ticket ? await signIn('sso', { ticket, redirect: false }).catch(() => undefined) : undefined
            // A full load, so every server component renders with the new session.
            window.location.href = result?.ok && !result.error ? destination : fallback
        })()
    }, [ticket, destination, fallback])

    return <p>Logger inn …</p>
}
