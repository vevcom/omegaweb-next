import '@pn-server-only'
import { workers } from './definitions'
import { prisma } from '@/prisma-pn-client-instance'
import logger from '@/lib/logger'
import type { Worker, WorkerName } from './types'

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

    async function loop({ name, intervalMs, tick }: Worker) {
        logger.info(`${name} started`)
        while (!stopping) {
            try {
                if (await tick()) continue
            } catch (error) {
                logger.error(`${name} tick failed: ${error}`)
            }
            if (!stopping) await sleep(intervalMs)
        }
        logger.info(`${name} stopped`)
    }

    (['SIGTERM', 'SIGINT'] as const).forEach(signal => {
        process.on(signal, () => {
            logger.info(`Workers received ${signal} - finishing current ticks before exiting`)
            stopping = true
            wakeUps.forEach(wakeUp => wakeUp())
        })
    })

    await Promise.all(selected.map(loop))
    await prisma.$disconnect()
}

function isWorkerName(name: string): name is WorkerName {
    return name in workers
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
