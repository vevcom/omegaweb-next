import { ServiceError } from '@/services/error'
import type { Awaitable } from '@/lib/awaitable'

/**
 * Gives every id its index in `orderedIds` as position, through `setPosition`. Refuses a list unless
 * it holds every existing id exactly once, since a list read before an item was added or removed is
 * stale and applying it would leave items unplaced.
 */
export async function applyReordering(
    orderedIds: number[],
    existingIds: number[],
    setPosition: (id: number, position: number) => Awaitable<unknown>,
): Promise<void> {
    const existing = new Set(existingIds)
    const isReordering = orderedIds.length === existing.size
        && new Set(orderedIds).size === orderedIds.length
        && orderedIds.every(id => existing.has(id))
    if (!isReordering) {
        throw new ServiceError(
            'BAD PARAMETERS',
            'Listen er endret siden den ble lastet inn. Last inn siden på nytt og prøv igjen.'
        )
    }

    await Promise.all(orderedIds.map((id, position) => setPosition(id, position)))
}
