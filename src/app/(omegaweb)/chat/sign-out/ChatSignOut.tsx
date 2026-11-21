'use client'
import { useChatSession } from '@/components/Chat/Session/ChatSessionProvider'
import useDomainContext from '@/hooks/useDomainContext'
import { useEffect, useState } from 'react'
import type { AppHref } from '@/lib/sites/href'

const GIVES_UP_AFTER_MS = 5000

/**
 * Sends the browser on to `callbackUrl` once the session of the tab has done what it does on
 * arrival: in a tab the logout page has asked a sign out in, that is to sign out of the chat, see
 * runChatSession, and opened from anywhere else it is nothing of the kind. The session is forgotten
 * at once, so the chat is not waited long for.
 */
export default function ChatSignOut({ callbackUrl: callbackAppPath }: { callbackUrl: AppHref }) {
    const { state } = useChatSession()
    const callbackUrl = useDomainContext().resolveHref(callbackAppPath)
    const [hasGivenUp, setHasGivenUp] = useState(false)
    const isDone = state.status !== 'STARTING' || hasGivenUp

    useEffect(() => {
        const givingUp = setTimeout(() => setHasGivenUp(true), GIVES_UP_AFTER_MS)
        return () => clearTimeout(givingUp)
    }, [])

    useEffect(() => {
        if (isDone) window.location.replace(callbackUrl)
    }, [isDone, callbackUrl])

    return <p className="m-0 text-base-content/80">Logger ut av chatten ...</p>
}
