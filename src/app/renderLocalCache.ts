import '@ow-server-only'
import { LocalCache, WritesTold } from '@/services/localCache'
import { cache } from 'react'
import type { LocalCachePlace } from '@/services/localCache'

/**
 * What React keeps for a render: the same object all through it, whoever asks, and a new one on
 * every call outside a render.
 */
const placeOf: (operation: object, key: string) => LocalCachePlace = cache(() => ({}))
const writesOf: () => WritesTold = cache(() => new WritesTold())

/**
 * Keeps its answers in React's `cache`, so they live for the render under way and are shared by
 * everything that begins one in that render: the layouts, the page and its sections. The writes
 * told to any of them are kept there too, so they are told to them all. Every render on the server
 * starts with nothing remembered. What Next does not render again, such as a layout it keeps
 * across a client navigation, is not read again either. Outside a render, as in an action or a
 * route handler, it remembers nothing.
 */
export class RenderLocalCache extends LocalCache {
    protected placeOf(operation: object, key: string) {
        return placeOf(operation, key)
    }

    protected writes() {
        return writesOf()
    }
}
