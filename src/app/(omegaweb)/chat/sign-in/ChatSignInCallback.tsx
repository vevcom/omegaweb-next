'use client'
import { useChatSession } from '@/components/Chat/Session/ChatSessionProvider'
import ChatSessionStatus from '@/components/Chat/Session/ChatSessionStatus'
import { chatLinks } from '@/app/(omegaweb)/chat/links'
import useSiteRouter from '@/hooks/useSiteRouter'
import { useEffect, useRef } from 'react'

/**
 * Where the chat's sign in sends the browser back. Its answer is in the fragment of the address,
 * which is never sent to the server, and is taken out of the address before it is used. The
 * session takes it once it has nothing else to run, and the visitor then goes on to the messages.
 */
export default function ChatSignInCallback() {
    const { state, completeSignIn } = useChatSession()
    const router = useSiteRouter()
    const answer = useRef<URLSearchParams | null | undefined>(undefined)

    useEffect(() => {
        if (answer.current === undefined) {
            const inAddress = new URLSearchParams(window.location.hash.slice(1))
            answer.current = inAddress.has('state') ? inAddress : null
            window.history.replaceState(window.history.state, '', window.location.pathname)
        }
        if (state.status === 'RUNNING') {
            router.replace(chatLinks.messages())
        } else if (state.status === 'SIGNED_OUT' && state.reason === 'NO_SESSION') {
            const toComplete = answer.current
            answer.current = null
            if (toComplete) completeSignIn(toComplete)
            else router.replace(chatLinks.messages())
        }
    }, [state, completeSignIn, router])

    const isOnItsWay = state.status === 'RUNNING' || (state.status === 'SIGNED_OUT' && state.reason === 'NO_SESSION')
    return isOnItsWay
        ? <p className="m-0 text-base-content/80">Logger inn på chatten ...</p>
        : <ChatSessionStatus />
}
