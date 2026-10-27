import '@pn-server-only'
import { workers } from './definitions'
import { prisma } from '@/prisma-pn-client-instance'
import logger from '@/lib/logger'
import { writeFile } from 'fs/promises'
import type { Worker, WorkerName } from './types'

/**
 * Rewritten every HEARTBEAT_INTERVAL_MS while no tick has run longer than MAX_TICK_MS. The worker's
 * liveness probe (deploy/base/worker.yaml) restarts the container once it goes stale, which catches
 * a tick stuck on a call that never returns as well as a blocked event loop.
 */
const HEARTBEAT_FILE = '/tmp/worker-heartbeat'
const HEARTBEAT_INTERVAL_MS = 30 * 1000
const MAX_TICK_MS = 10 * 60 * 1000

/**
 * Runs the workers side by side in this process until it receives SIGTERM or SIGINT. Each one
 * calls its `tick`, then waits its `intervalMs` before the next unless the tick says there may be
 * more work waiting. A tick that throws (including on the database being unreachable, e.g. while
 * the schema is being reset in dev) is logged and that worker goes on, rather than the process
 * dying.
 *
 * A stop signal lets every worker finish its current tick and cuts the waits short, so the process
 * exits right away however long the intervals are.
 */
async function runWorkers(selected: Worker[]) {
    let stopping = false
    const wakeUps = new Set<() => void>()

    // The timer must also be cleared on wake-up - a pending timeout keeps the node process alive
    // long after the loops have exited.
    const sleep = (ms: number) => new Promise<void>(resolve => {
        let timeout: ReturnType<typeof setTimeout> | undefined = undefined
        const wakeUp = () => {
            clearTimeout(timeout)
            wakeUps.delete(wakeUp)
            resolve()
        }
        timeout = setTimeout(wakeUp, ms)
        wakeUps.add(wakeUp)
    })

    const tickStartedAt = new Map<string, number>()

    async function loop({ name, intervalMs, tick }: Worker) {
        logger.info(`${name} started`)
        while (!stopping) {
            tickStartedAt.set(name, Date.now())
            try {
                if (await tick()) continue
            } catch (error) {
                logger.error(`${name} tick failed: ${error}`)
            } finally {
                tickStartedAt.delete(name)
            }
            if (!stopping) await sleep(intervalMs)
        }
        logger.info(`${name} stopped`)
    }

    async function beat() {
        const stuck = Array.from(tickStartedAt).filter(([, startedAt]) => Date.now() - startedAt > MAX_TICK_MS)
        if (stuck.length > 0) {
            logger.error(`Workers stopped their heartbeat, since a tick has run too long: ${
                stuck.map(([name]) => name).join(', ')
            }`)
            return
        }
        await writeFile(HEARTBEAT_FILE, String(Date.now())).catch((error: unknown) => {
            logger.error(`Workers failed to write their heartbeat: ${error}`)
        })
    }

    (['SIGTERM', 'SIGINT'] as const).forEach(signal => {
        process.on(signal, () => {
            logger.info(`Workers received ${signal} - finishing current ticks before exiting`)
            stopping = true
            wakeUps.forEach(wakeUp => wakeUp())
        })
    })

    await beat()
    const heartbeat = setInterval(() => void beat(), HEARTBEAT_INTERVAL_MS)

    await Promise.all(selected.map(loop))
    clearInterval(heartbeat)
    await prisma.$disconnect()
}

function isWorkerName(name: string): name is WorkerName {
    return Object.hasOwn(workers, name)
}

/**
 * Entrypoint for the worker container (`npm run worker`). Runs the workers defined in
 * definitions.ts that are named as arguments, or all of them when none are named - so one of them
 * can be given a container of its own by naming it there and leaving it out of the other.
 */
async function main() {
    const requested = process.argv.slice(2)
    const unknown = requested.filter(name => !isWorkerName(name))
    if (unknown.length > 0) {
        throw new Error(`Unknown worker(s): ${unknown.join(', ')}. Known: ${Object.keys(workers).join(', ')}`)
    }
    const names = requested.length > 0 ? requested.filter(isWorkerName) : Object.keys(workers).filter(isWorkerName)
    await runWorkers(names.map(name => workers[name]))
}

main().catch((error: unknown) => {
    logger.error(`Workers crashed: ${error}`)
    process.exitCode = 1
})
