'use client'
import { chatSessionBrowser } from '@/lib/chatSession/browser'
import { runChatSession } from '@/lib/chatSession/run'
import { isChatPagePath } from '@/app/(omegaweb)/chat/config'
import { chatLinks } from '@/app/(omegaweb)/chat/links'
import useDomainContext from '@/hooks/useDomainContext'
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ChatSessionRun, ChatSessionState } from '@/lib/chatSession/run'
import type { ChatSessionConfig } from '@/services/chat/session/types'
import type { ReactNode } from 'react'

type ChatSession = {
    state: ChatSessionState,
    /** Whether the user has an account on the chat. Signing in is what gives them one. */
    hasAccount: boolean,
    signIn: () => void,
    completeSignIn: (answer: URLSearchParams) => void,
    /** Starts over, after the chat could not be reached. */
    retry: () => void,
}

const ChatSessionContext = createContext<ChatSession | null>(null)

export function useChatSession(): ChatSession {
    const session = useContext(ChatSessionContext)
    if (!session) throw new Error('useChatSession must be used within a ChatSessionProvider')
    return session
}

/**
 * Whether the document was loaded at a chat page. Only then has it the content security policy
 * that lets it reach the chat, see the proxy: a visitor who came from another page without a new
 * load is in a document that has not.
 */
function wasLoadedAtChatPage(): boolean {
    const [navigation] = performance.getEntriesByType('navigation')
    return navigation === undefined || isChatPagePath(new URL(navigation.name).pathname)
}

/** The browser as the session uses it, or null where the site's storage is blocked, which the session cannot do without. */
function browserOrNull() {
    try {
        return chatSessionBrowser()
    } catch {
        return null
    }
}

type PropTypes = {
    config: ChatSessionConfig,
    children: ReactNode,
}

/**
 * The session the browser has with the chat, for every chat page: one client of the homeserver,
 * which runs while the visitor is on them and is stopped when they leave.
 */
export default function ChatSessionProvider({ config: { homeserverUrl, clientId, matrixUserId }, children }: PropTypes) {
    const [state, setState] = useState<ChatSessionState>({ status: 'STARTING' })
    const [attempt, setAttempt] = useState(0)
    const run = useRef<ChatSessionRun | null>(null)
    const redirectHref = useDomainContext().resolveHref(chatLinks.signIn())

    useEffect(() => {
        if (!wasLoadedAtChatPage()) {
            window.location.reload()
            return undefined
        }
        const browser = browserOrNull()
        if (!browser) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- The browser is first known here.
            setState({ status: 'FAILED' })
            return undefined
        }
        const started = runChatSession({
            config: { homeserverUrl, clientId, matrixUserId },
            browser,
            redirectUri: new URL(redirectHref, window.location.origin).href,
            show: shown => setState(previous => (isSameState(previous, shown) ? previous : shown)),
        })
        run.current = started
        return () => {
            started.stop()
            run.current = null
        }
    }, [homeserverUrl, clientId, matrixUserId, redirectHref, attempt])

    const session = useMemo(() => ({
        state,
        hasAccount: matrixUserId !== null,
        signIn: () => void run.current?.signIn(),
        completeSignIn: (answer: URLSearchParams) => void run.current?.completeSignIn(answer),
        retry: () => {
            setState({ status: 'STARTING' })
            setAttempt(previous => previous + 1)
        },
    }), [state, matrixUserId])

    return <ChatSessionContext.Provider value={session}>{children}</ChatSessionContext.Provider>
}

/**
 * Whether a state that is shown is the one that was. A running client shows its state anew at
 * every sync, and the components are only to render again when it is another.
 */
function isSameState(one: ChatSessionState, other: ChatSessionState): boolean {
    const [before, after]: Record<string, unknown>[] = [one, other]
    const keys = Object.keys(after)
    return Object.keys(before).length === keys.length && keys.every(key => before[key] === after[key])
}
