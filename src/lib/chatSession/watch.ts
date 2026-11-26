import { loadedChatSdk } from './sdk'
import type { MatrixClient } from 'matrix-js-sdk'

/**
 * Something of the chat that a component shows and that changes by itself. `read` gives the same
 * object until it has changed and `subscribe` tells when it has, which is how React's
 * useSyncExternalStore takes a store. A component renders again only when what it shows has
 * changed, and not at every sync.
 */
export type Watched<Shown> = {
    subscribe: (onChange: () => void) => () => void,
    read: () => Shown,
}

/**
 * What `read` gives of a client, read again at every sync and told of only when it is no longer
 * the same. For what is cheap to read and may change with anything the homeserver sends.
 */
export function watchAtSync<Shown>(
    client: MatrixClient,
    read: () => Shown,
    isSame: (one: Shown, other: Shown) => boolean = Object.is,
): Watched<Shown> {
    const { ClientEvent } = loadedChatSdk()
    let shown: { is: Shown } | null = null
    const readAgain = () => {
        const now = read()
        if (!shown || !isSame(shown.is, now)) shown = { is: now }
        return shown.is
    }
    return {
        subscribe: onChange => {
            const onSync = () => {
                const before = shown
                readAgain()
                if (shown !== before) onChange()
            }
            // eslint-disable-next-line no-sync -- The event of the client's sync, and no synchronous call.
            client.on(ClientEvent.Sync, onSync)
            return () => {
                // eslint-disable-next-line no-sync -- As above.
                client.off(ClientEvent.Sync, onSync)
            }
        },
        read: readAgain,
    }
}

/** Whether two lists hold the same flat objects in the same order. */
export function isSameList<Item extends Record<string, unknown>>(one: readonly Item[], other: readonly Item[]): boolean {
    return one.length === other.length && one.every((item, index) => {
        const keys = Object.keys(item)
        return keys.length === Object.keys(other[index]).length && keys.every(key => item[key] === other[index][key])
    })
}
