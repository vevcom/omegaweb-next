import '@pn-server-only'

/** One thing the sync does to the homeserver, with the words that name it when it is refused. */
export type Change = {
    what: string,
    run: () => Promise<unknown>,
}

/**
 * What one run of the sync did. A change the homeserver refuses does not stop the run: it is
 * noted, and the run goes on with the next.
 */
export class SyncReport {
    carriedOut = 0
    readonly refused: string[] = []

    /** @returns whether the homeserver took the change. */
    async carryOut({ what, run }: Change): Promise<boolean> {
        try {
            await run()
            this.carriedOut++
            return true
        } catch (error) {
            this.refuse(what, error)
            return false
        }
    }

    refuse(what: string, error: unknown): void {
        this.refused.push(`${what}: ${String(error)}`)
    }

    /** @returns whether the homeserver took every change. */
    async carryOutAll(changes: Change[]): Promise<boolean> {
        let tookAll = true
        for (const change of changes) tookAll = await this.carryOut(change) && tookAll
        return tookAll
    }
}
