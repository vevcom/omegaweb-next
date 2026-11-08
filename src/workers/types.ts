import type { workers } from './definitions'
import type { Awaitable } from '@/lib/awaitable'

export type Worker = {
    name: string,
    /** How long to wait between ticks, unless a tick says there may be more work waiting. */
    intervalMs: number,
    /**
     * Does one round of work. Returns true when there may be more waiting, to skip the wait. A tick
     * that can outlast main.ts's MAX_TICK_MS calls `progress` as it goes, so it is not taken for stuck.
     */
    tick: (progress: () => void) => Awaitable<boolean | void>,
}

/** The name a worker is defined under in definitions.ts, and is run by from main.ts. */
export type WorkerName = keyof typeof workers
