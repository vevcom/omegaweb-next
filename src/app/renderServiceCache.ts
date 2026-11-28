import '@ow-server-only'
import { cache } from 'react'
import type { ServiceCache } from '@/services/serviceCache'

type Kept = { answer?: Promise<unknown> }

/**
 * What React keeps for an operation and a key: the same object all through a render, whoever asks,
 * and a new one on every call outside a render.
 */
const keptOf: (operation: object, key: string) => Kept = cache(() => ({}))

/**
 * Keeps its answers in React's `cache`, so they live for the render under way and are shared by
 * every context opened in that render: the layouts, the page and its sections. Every render on the
 * server starts with nothing remembered. What Next does not render again, such as a layout it keeps
 * across a client navigation, is not read again either. Outside a render, as in an action or a
 * route handler, it remembers nothing.
 */
export class RenderServiceCache implements ServiceCache {
    public remember(operation: object, key: string, read: () => Promise<unknown>) {
        const kept = keptOf(operation, key)
        kept.answer ??= read()
        return kept.answer
    }
}
