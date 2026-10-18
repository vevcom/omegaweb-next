import '@pn-server-only'
import { runImageProcessingWorker, stopImageProcessingWorker } from '@/services/images/subservice/worker'
import { prisma } from '@/prisma-pn-client-instance'
import logger from '@/lib/logger'

/**
 * Entrypoint for the background worker container (`npm run worker`).
 */
async function main() {
    for (const signal of ['SIGTERM', 'SIGINT'] as const) {
        process.on(signal, () => {
            logger.info(`Worker received ${signal} - finishing current image before exiting`)
            stopImageProcessingWorker()
        })
    }

    logger.info('Image processing worker started')
    await runImageProcessingWorker()
    await prisma.$disconnect()
    logger.info('Image processing worker stopped')
}

main().catch((error: unknown) => {
    logger.error(`Image processing worker crashed: ${error}`)
    process.exitCode = 1
})
