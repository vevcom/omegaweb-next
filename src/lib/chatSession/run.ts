import { chatClientOf, holdTabLock, signOut, stopChatClient } from './client'
import { loadChatSdk } from './sdk'
import { completeSignIn, startSignIn } from './signIn'
import { forgetSession, readStoredSession, takeSignOutRequest } from './storage'
import type { ChatSessionBrowser } from './browser'
import type { ChatSignInRefusal } from './signIn'
import type { StoredChatSession } from './storage'
import type { ChatSessionConfig } from '@/services/chat/session/types'
import type { Awaitable } from '@/lib/awaitable'
import type { MatrixClient } from 'matrix-js-sdk'

export type ChatSessionState =
    | { status: 'STARTING' }
    /** Another tab runs the client. This one takes over when that one lets go. */
    | { status: 'WAITING_FOR_TAB' }
    /**
     * The browser has no session: none was kept, the one it had has ended, or the sign in was
     * refused.
     */
    | { status: 'SIGNED_OUT', reason: 'NO_SESSION' | 'ENDED' | ChatSignInRefusal }
    /** On the way to the chat's sign in, or trading the answer it gave for tokens. */
    | { status: 'SIGNING_IN' }
    /** The client runs. It is shown anew at every sync, also when nothing of it has changed. */
    | { status: 'RUNNING', client: MatrixClient, connection: 'CONNECTING' | 'CONNECTED' | 'LOST' }
    /** The chat could not be reached to sign in, or the client could not start. */
    | { status: 'FAILED' }

export type ChatSessionRun = {
    /** Sends the browser to the chat's sign in, which sends it back to `redirectUri`. */
    signIn: () => Promise<void>,
    /** Takes the answer the chat's sign in sent the browser back with, and runs the client when it signed in. */
    completeSignIn: (answer: URLSearchParams) => Promise<void>,
    stop: () => void,
}

type Params = {
    config: ChatSessionConfig,
    browser: ChatSessionBrowser,
    redirectUri: string,
    show: (state: ChatSessionState) => void,
}

/**
 * What this tab runs or waits to run: `life` holds the tab's lock until it is aborted. The session
 * is null until the tab has the lock, and so is the client until it is made.
 */
type Running = {
    life: AbortController,
    session: StoredChatSession | null,
    client: MatrixClient | null,
}

/**
 * Runs the chat session of a tab until it is stopped: runs the client of the session the browser
 * has kept, as the one tab that does, and says with `show` where it stands. A kept session that is
 * another user's than the one signed in here is signed out and not used. A tab with no session to
 * run holds no lock, so it keeps no other tab from signing in. A tab the logout page has asked a
 * sign out in signs out and runs nothing, see requestSignOut.
 */
export function runChatSession({ config, browser, redirectUri, show }: Params): ChatSessionRun {
    const stopped = new AbortController()
    let running: Running | null = null
    let isSigningIn = false

    const showUnlessStopped = (state: ChatSessionState) => {
        if (!stopped.signal.aborted) show(state)
    }

    const letGo = () => {
        const letGoOf = running
        running = null
        letGoOf?.life.abort()
        if (letGoOf?.client) stopChatClient(letGoOf.client)
    }

    const end = async (ended: Running) => {
        if (running !== ended) return
        letGo()
        await forgetSession(browser)
        showUnlessStopped({ status: 'SIGNED_OUT', reason: 'ENDED' })
    }

    /**
     * Runs the client of the session `kept` gives, once this tab is the one to run it. The session
     * is asked for with the lock held: the tab that ran the client until then may have traded the
     * tokens for new ones or ended the session, and a tab that signs in is to have the lock before
     * the session it keeps is there for another tab to run.
     */
    const runSession = async (kept: () => Awaitable<StoredChatSession | null>) => {
        if (stopped.signal.aborted) return
        letGo()
        const mine: Running = { life: new AbortController(), session: null, client: null }
        running = mine
        // The lock is kept while a client is being started, also when the tab has let go of it
        // meanwhile: another tab would otherwise start its own on the same keys.
        let starting: Promise<unknown> = Promise.resolve()
        const onWaiting = () => showUnlessStopped({ status: 'WAITING_FOR_TAB' })
        await holdTabLock(browser.locks, mine.life.signal, onWaiting, () => starting)
            .catch((error: unknown) => {
                if (!mine.life.signal.aborted) throw error
            })
        if (running !== mine) return

        const session = await kept()
        if (running !== mine) return
        if (!session) {
            letGo()
            return
        }
        mine.session = session

        const { ClientEvent, HttpApiEvent, PendingEventOrdering, SyncState } = await loadChatSdk()
        const started = chatClientOf(config, browser, session).then(made => {
            if (running === mine) return made
            stopChatClient(made)
            return null
        })
        starting = started
        const client = await started
        if (!client) return
        mine.client = client
        client.on(HttpApiEvent.SessionLoggedOut, () => void end(mine))
        // eslint-disable-next-line no-sync -- The event of the client's sync, and no synchronous call.
        client.on(ClientEvent.Sync, state => {
            if (state === SyncState.Stopped || running !== mine) return
            const isLost = state === SyncState.Error || state === SyncState.Reconnecting
            showUnlessStopped({ status: 'RUNNING', client, connection: isLost ? 'LOST' : 'CONNECTED' })
        })
        showUnlessStopped({ status: 'RUNNING', client, connection: 'CONNECTING' })
        // What the user sends is kept apart from a room's timeline until the homeserver sends it back.
        await client.startClient({ lazyLoadMembers: true, pendingEventOrdering: PendingEventOrdering.Detached })
    }

    /** The session the browser has kept, when it is still the user's, and says so when it has ended meanwhile. */
    const keptSession = () => {
        const kept = readStoredSession(browser)
        if (kept?.userId === config.matrixUserId) return kept
        showUnlessStopped({ status: 'SIGNED_OUT', reason: 'ENDED' })
        return null
    }

    const orFail = (work: Promise<void>) => work.catch((error: unknown) => {
        if (stopped.signal.aborted) return
        console.error('The chat session failed', error)
        letGo()
        show({ status: 'FAILED' })
    })

    // What another tab did: it signed the browser out, which leaves this one to stop, or it signed
    // the user in, which gives this one a session to run once that tab lets go.
    const stopWatching = browser.watchKept(() => {
        const kept = readStoredSession(browser)
        if (!running) {
            if (kept?.userId === config.matrixUserId) void orFail(runSession(keptSession))
        } else if (running.session && kept?.userId !== running.session.userId) {
            letGo()
            showUnlessStopped({ status: 'SIGNED_OUT', reason: 'ENDED' })
        }
    })

    const run = async () => {
        if (takeSignOutRequest(browser)) {
            await signOut(config, browser).catch(() => undefined)
            showUnlessStopped({ status: 'SIGNED_OUT', reason: 'ENDED' })
            return
        }
        const kept = readStoredSession(browser)
        if (kept && kept.userId !== config.matrixUserId) await signOut(config, browser).catch(() => undefined)
        if (readStoredSession(browser)) await runSession(keptSession)
        else showUnlessStopped({ status: 'SIGNED_OUT', reason: 'NO_SESSION' })
    }

    void orFail(run())

    return {
        signIn: () => orFail((async () => {
            if (isSigningIn) return
            isSigningIn = true
            showUnlessStopped({ status: 'SIGNING_IN' })
            const url = await startSignIn(config, browser, redirectUri)
            if (!stopped.signal.aborted) browser.leaveFor(url)
        })()),
        completeSignIn: answer => orFail(runSession(async () => {
            showUnlessStopped({ status: 'SIGNING_IN' })
            const result = await completeSignIn(config, browser, redirectUri, answer)
            if (result.signedIn) return result.session
            showUnlessStopped({ status: 'SIGNED_OUT', reason: result.refusal })
            return null
        })),
        stop: () => {
            stopped.abort()
            stopWatching()
            letGo()
        },
    }
}
