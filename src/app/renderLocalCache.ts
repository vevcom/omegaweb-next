import '@ow-server-only'
import { LocalCache } from '@/services/localCache'
import { cache } from 'react'

type Kept = { answer?: Promise<unknown> }

/** What React keeps for a render: how many times its answers have been cleared. */
const clearingsOf: () => { count: number } = cache(() => ({ count: 0 }))

/**
 * What React keeps for an operation and a key since the last clearing: the same object all through
 * a render, whoever asks, and a new one on every call outside a render.
 */
const keptOf: (operation: object, key: string, clearings: number) => Kept = cache(() => ({}))

/**
 * Keeps its answers in React's `cache`, so they live for the render under way and are shared by
 * everything that begins one in that render: the layouts, the page and its sections. Every render
 * on the server starts with nothing remembered. What Next does not render again, such as a layout
 * it keeps across a client navigation, is not read again either. Outside a render, as in an action
 * or a route handler, it remembers nothing.
 */
export class RenderLocalCache extends LocalCache {
    public remember(operation: object, key: string, read: () => Promise<unknown>) {
        const kept = keptOf(operation, key, clearingsOf().count)
        kept.answer ??= read()
        return kept.answer
    }

    // React's `cache` cannot be emptied, so what was kept before a clearing is no longer asked for.
    // Every cache of a render counts on the one count, so one begun inside another only counts twice.
    protected clearOwn() {
        clearingsOf().count++
    }
}
