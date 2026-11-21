/** What a storage of the browser is used for here, which a test gives a plain map for. */
export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/**
 * The browser as the chat session uses it. Everything in src/lib/chatSession runs in the browser
 * alone and reaches it through this, so the tests hand it one of their own.
 */
export type ChatSessionBrowser = {
    /** Kept between visits, on the origin of Omega's site: localStorage. */
    kept: KeyValueStorage,
    /** Kept while the tab lives: sessionStorage. */
    keptInTab: KeyValueStorage,
    /** Where the SDK keeps what it has synced. Undefined in a browser without it, which then syncs anew at every visit. */
    indexedDB: IDBFactory | undefined,
    locks: Pick<LockManager, 'request'>,
    /** Sends the browser to another address, in place of the page it is on. */
    leaveFor: (url: string) => void,
    /** Calls `listener` when another tab changes what is kept between visits. Returns how to stop it. */
    watchKept: (listener: () => void) => () => void,
    /** Left out, the browser's own fetch. */
    fetch?: typeof globalThis.fetch,
}

export function chatSessionBrowser(): ChatSessionBrowser {
    return {
        kept: window.localStorage,
        keptInTab: window.sessionStorage,
        indexedDB: window.indexedDB,
        locks: navigator.locks,
        leaveFor: url => window.location.replace(url),
        watchKept: listener => {
            window.addEventListener('storage', listener)
            return () => window.removeEventListener('storage', listener)
        },
    }
}
