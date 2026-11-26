import 'fake-indexeddb/auto'
import { runChatSession } from '@/lib/chatSession/run'
import { IDBFactory } from 'fake-indexeddb'
import type { ChatSessionRun } from '@/lib/chatSession/run'
import type { ChatSessionBrowser } from '@/lib/chatSession/browser'
import type { MatrixClient } from 'matrix-js-sdk'
import type { jest } from '@jest/globals'
import type { ChatSessionConfig } from '@/services/chat/session/types'

export const HOMESERVER = 'https://matrix.chat.test'
export const CHAT_AUTH = 'https://account.chat.test'
export const REDIRECT_URI = 'https://omega.ntnu.no/chat/sign-in'
const JOIN = '/_matrix/client/v3/join/'

export const configFor = (matrixUserId: string | null): ChatSessionConfig => ({
    homeserverUrl: HOMESERVER,
    clientId: '000000000000000000MEGACHAT',
    matrixUserId,
})

/**
 * Quiets the SDK, which logs every request, and lets go of the timers it leaves behind: it keeps
 * the timer of a request's timeout after the request is answered, which would hold the test
 * process for minutes. To be called in a `beforeAll`.
 */
export function tameChatSdk(spyOn: typeof jest.spyOn): void {
    const setTimeoutOfNode = globalThis.setTimeout
    spyOn(globalThis, 'setTimeout').mockImplementation(((...args: Parameters<typeof setTimeout>) =>
        setTimeoutOfNode(...args).unref()) as typeof setTimeout)
    for (const level of ['debug', 'info', 'log', 'warn', 'error'] as const) {
        spyOn(console, level).mockImplementation(() => undefined)
    }
}

const runs: ChatSessionRun[] = []
const untaken = new Set<Promise<void>>()
const NEWS_WAIT_MS = 10_000

/**
 * Resolves when the clients have taken everything the tests' homeservers have told of, and what
 * followed from it has run. A test waits for this and not for a time: how long a client takes
 * over a sync answer depends on what else the machine is doing. News no client will take, since
 * it was stopped or does not sync, is waited for NEWS_WAIT_MS and no longer.
 */
export async function newsTaken(): Promise<void> {
    const all = Promise.all(untaken)
    await Promise.race([all, new Promise(resolve => setTimeout(resolve, NEWS_WAIT_MS))])
    await new Promise(resolve => setTimeout(resolve, 0))
}


/**
 * The client of the session a browser has kept for the user, once it runs and has synced, as a
 * chat page has it. To be stopped with `stopSyncedChatClients` in an `afterEach`.
 */
export function syncedChatClient(browser: ChatSessionBrowser, matrixUserId: string): Promise<MatrixClient> {
    return new Promise(resolve => {
        runs.push(runChatSession({
            config: configFor(matrixUserId),
            browser,
            redirectUri: REDIRECT_URI,
            show: state => {
                if (state.status === 'RUNNING' && state.connection === 'CONNECTED') resolve(state.client)
            },
        }))
    })
}

/** Stops the clients of `syncedChatClient`, and waits while the SDK finishes what it was writing. */
export async function stopSyncedChatClients(): Promise<void> {
    runs.splice(0).forEach(run => run.stop())
    untaken.clear()
    await new Promise(resolve => setTimeout(resolve, 50))
}

export type ChatCall = {
    method: string,
    url: URL,
    /** What a form posted to the chat's sign in held. */
    form: URLSearchParams,
    /** What was sent to the homeserver as JSON. */
    json: unknown,
    /** A file that was sent to the homeserver, as what it was said to be. */
    file: Blob | null,
    contentType: string | null,
    token: string | null,
}

/** A body that is a file is answered as that file, and any other as JSON. */
type Answer = { status?: number, body: unknown } | 'UNREACHABLE' | 'NEVER'
/** An answer, at once or when the test has it. */
type Answering = (call: ChatCall) => Answer | Promise<Answer>

const authMetadata = {
    issuer: `${CHAT_AUTH}/`,
    authorization_endpoint: `${CHAT_AUTH}/authorize`,
    token_endpoint: `${CHAT_AUTH}/oauth2/token`,
    revocation_endpoint: `${CHAT_AUTH}/oauth2/revoke`,
    registration_endpoint: `${CHAT_AUTH}/oauth2/registration`,
    response_types_supported: ['code'],
    response_modes_supported: ['query', 'fragment'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
}

/**
 * A browser with nothing kept, and a chat that answers it: the homeserver at HOMESERVER and its
 * sign in at CHAT_AUTH. The sign in hands out `access-1` and `refresh-1`, then `access-2` and so
 * on, and the homeserver says they are the tokens of `account`. It answers a first sync with
 * `rooms` and holds every later one, as a homeserver does until there is news. It keeps the keys a
 * device publishes and gives them to whoever asks, and has no backup of keys. `answer` says what
 * a path answers in place of that, at once or when the test has it, and `tellingOfNews` makes the
 * later syncs the test's to answer. `browser` is one tab of it and `openTab` gives another: the tabs
 * share what is kept between visits, the synced databases and the lock, and each is told of what
 * another changes in what is kept.
 */
export function fakeChatBrowser() {
    const kept = new Map<string, string>()
    const calls: ChatCall[] = []
    const leftFor: string[] = []
    const watchersOfTabs = new Set<Set<() => void>>()
    const indexedDB = new IDBFactory()
    // The SDK keeps the keys of a device in the IndexedDB of the page it runs in, whatever it is handed.
    globalThis.indexedDB = indexedDB
    const answers = new Map<string, Answering>()
    const answersUnder: [string, Answering][] = []
    // The keys the devices have published, which a device asks for its own of too.
    const deviceKeys = new Map<string, Record<string, object>>()
    let heldRequests = 0
    const chat = { account: '@kari:chat.test', tokensGiven: 0, rooms: {} as object }

    const storageOf = (map: Map<string, string>, onChange: () => void = () => undefined) => ({
        getItem: (key: string) => map.get(key) ?? null,
        setItem: (key: string, value: string) => {
            map.set(key, value)
            onChange()
        },
        removeItem: (key: string) => {
            map.delete(key)
            onChange()
        },
    })

    const defaultAnswer = (call: ChatCall): Answer => {
        switch (`${call.url.origin}${call.url.pathname}`) {
            case `${HOMESERVER}/_matrix/client/v1/auth_metadata`:
                return { body: authMetadata }
            case `${HOMESERVER}/_matrix/client/v3/account/whoami`:
                return { body: { user_id: chat.account } }
            case `${HOMESERVER}/_matrix/client/v3/sync`:
                return call.url.searchParams.has('since') ? 'NEVER' : { body: { next_batch: 'first', rooms: chat.rooms } }
            case authMetadata.token_endpoint:
                chat.tokensGiven++
                return {
                    body: {
                        access_token: `access-${chat.tokensGiven}`,
                        refresh_token: `refresh-${chat.tokensGiven}`,
                        token_type: 'Bearer',
                        expires_in: 300,
                    },
                }
            case `${HOMESERVER}/_matrix/client/v3/keys/upload`: {
                const { device_keys: uploaded } = call.json as { device_keys?: { user_id: string, device_id: string } }
                const ofUser = deviceKeys.get(uploaded?.user_id ?? '')
                if (uploaded) deviceKeys.set(uploaded.user_id, { ...ofUser, [uploaded.device_id]: uploaded })
                return { body: { one_time_key_counts: { signed_curve25519: 50 } } }
            }
            case `${HOMESERVER}/_matrix/client/v3/keys/query`: {
                const asked = Object.keys((call.json as { device_keys: object }).device_keys)
                const published = asked.map(userId => [userId, deviceKeys.get(userId) ?? {}] as const)
                return { body: { device_keys: Object.fromEntries(published) } }
            }
            case `${HOMESERVER}/_matrix/client/v3/room_keys/version`:
                return { status: 404, body: { errcode: 'M_NOT_FOUND', error: 'No current backup version' } }
            default:
                return call.url.pathname.startsWith(JOIN)
                    ? { body: { room_id: decodeURIComponent(call.url.pathname.slice(JOIN.length)) } }
                    : { body: {} }
        }
    }

    const fetch: typeof globalThis.fetch = (input, init) => {
        const url = new URL(input instanceof Request ? input.url : input)
        const headers = new Headers(init?.headers)
        const call = {
            method: init?.method ?? 'GET',
            url,
            form: new URLSearchParams(init?.body instanceof URLSearchParams ? init.body : undefined),
            json: typeof init?.body === 'string' ? JSON.parse(init.body) as unknown : undefined,
            file: init?.body instanceof Blob ? init.body : null,
            contentType: headers.get('Content-Type'),
            token: headers.get('Authorization'),
        }
        calls.push(call)
        const aborted = () => new Promise<Response>((_, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
        })
        const held = () => {
            heldRequests++
            init?.signal?.addEventListener('abort', () => heldRequests--)
            return aborted()
        }
        const respond = (answer: Answer) => {
            if (answer === 'UNREACHABLE') return Promise.reject(new TypeError('fetch failed'))
            if (answer === 'NEVER') return held()
            const isFile = answer.body instanceof Blob
            return Promise.resolve(new Response(isFile ? answer.body as Blob : JSON.stringify(answer.body), {
                status: answer.status ?? 200,
                headers: { 'Content-Type': isFile ? (answer.body as Blob).type : 'application/json' },
            }))
        }
        const answering = answers.get(url.pathname)
            ?? answersUnder.find(([pathnameStart]) => url.pathname.startsWith(pathnameStart))?.[1]
            ?? defaultAnswer
        const answer = answering(call)
        return answer instanceof Promise ? Promise.race([answer.then(respond), aborted()]) : respond(answer)
    }

    let lockIsHeld = false
    const waitingForLock: (() => void)[] = []
    const request = async (
        name: string,
        options: LockOptions,
        callback: (lock: Lock | null) => unknown,
    ): Promise<unknown> => {
        if (lockIsHeld) {
            if (options.ifAvailable) return callback(null)
            await new Promise<void>((resolve, reject) => {
                waitingForLock.push(resolve)
                options.signal?.addEventListener('abort', () => {
                    waitingForLock.splice(waitingForLock.indexOf(resolve), 1)
                    reject(new DOMException('Aborted', 'AbortError'))
                })
            })
        }
        lockIsHeld = true
        try {
            return await callback({ name, mode: 'exclusive' })
        } finally {
            lockIsHeld = false
            waitingForLock.shift()?.()
        }
    }

    const openTab = () => {
        const watchers = new Set<() => void>()
        const keptInTab = new Map<string, string>()
        watchersOfTabs.add(watchers)
        const tellOtherTabs = () => watchersOfTabs.forEach(ofTab => {
            if (ofTab !== watchers) ofTab.forEach(watcher => watcher())
        })
        const browser: ChatSessionBrowser = {
            kept: storageOf(kept, tellOtherTabs),
            keptInTab: storageOf(keptInTab),
            indexedDB,
            locks: { request } as ChatSessionBrowser['locks'],
            leaveFor: url => {
                leftFor.push(url)
            },
            watchKept: listener => {
                watchers.add(listener)
                return () => watchers.delete(listener)
            },
            fetch,
        }
        return { browser, keptInTab }
    }
    const { browser, keptInTab } = openTab()

    return {
        browser,
        openTab: () => openTab().browser,
        /** The names of the databases the browser holds. */
        databases: async () => (await indexedDB.databases()).map(database => database.name).toSorted(),
        /**
         * The names of the databases left once those being deleted are gone. A deletion waits for
         * the tab that has the database open to close it, which a client does as it is stopped.
         */
        databasesLeft: async () => {
            const names = async () => (await indexedDB.databases()).map(database => database.name).toSorted()
            for (let waits = 0; waits < 250 && (await names()).length > 0; waits++) {
                await new Promise(resolve => setTimeout(resolve, 20))
            }
            return names()
        },
        makeDatabase: (name: string) => new Promise<void>((resolve, reject) => {
            const opening = indexedDB.open(name)
            opening.onsuccess = () => {
                opening.result.close()
                resolve()
            }
            opening.onerror = () => reject(new Error(`Could not make ${name}`))
        }),
        chat,
        kept,
        keptInTab,
        calls,
        leftFor,
        /** What the path answers from now on, in place of what the chat would. */
        answer: (pathname: string, answer: Answering) => {
            answers.set(pathname, answer)
        },
        /** What every path that starts so answers from now on, where no path is given an answer of its own. */
        answerUnder: (pathnameStart: string, answer: Answering) => {
            answersUnder.unshift([pathnameStart, answer])
        },
        /**
         * Lets the test say what the homeserver tells of after the first sync: `tell` answers the
         * sync that waits, or the next to come, with what has happened in the rooms, and with what
         * has been noted in the user's account. The client has taken that answer when it asks on
         * from it, which newsTaken waits for.
         */
        tellingOfNews: () => {
            type Told = { told: object, taken: () => void }
            const news: Told[] = []
            const takenAt = new Map<string, () => void>()
            let tellings = 0
            let waiting: ((answer: Answer) => void) | null = null
            const answerWith = ({ told, taken }: Told): Answer => {
                takenAt.set(`news-${++tellings}`, taken)
                return { body: { next_batch: `news-${tellings}`, ...told } }
            }
            answers.set('/_matrix/client/v3/sync', call => {
                if (!call.url.searchParams.has('since')) return { body: { next_batch: 'first', rooms: chat.rooms } }
                // The client asks on from an answer once it has taken all of it.
                takenAt.get(call.url.searchParams.get('since') ?? '')?.()
                const told = news.shift()
                return told ? answerWith(told) : new Promise<Answer>(resolve => {
                    waiting = resolve
                })
            })
            return {
                tell: (rooms: object, accountData: object[] = []) => {
                    const telling = new Promise<void>(taken => {
                        const told = { told: { rooms, account_data: { events: accountData } }, taken }
                        const answerTheOneThatWaits = waiting
                        waiting = null
                        if (answerTheOneThatWaits) answerTheOneThatWaits(answerWith(told))
                        else news.push(told)
                    })
                    untaken.add(telling)
                    void telling.then(() => untaken.delete(telling))
                },
            }
        },
        callsTo: (pathname: string) => calls.filter(call => call.url.pathname === pathname),
        /** How many requests the chat holds unanswered, as it holds the long poll of a running client. */
        heldRequests: () => heldRequests,
    }
}
