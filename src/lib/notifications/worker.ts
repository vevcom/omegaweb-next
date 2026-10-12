import '@pn-server-only'
import { runNotificationWorker, stopNotificationWorker } from '@/services/notifications/methods/worker'
import { prisma } from '@/prisma-pn-client-instance'
import logger from '@/lib/logger'

/**
 * Entrypoint for the notification worker container (`npm run notification-worker`). It dispatches all
 * notification sending: immediate emails and the weekly digest mails.
 */
async function main() {
    (['SIGTERM', 'SIGINT'] as const).forEach(signal => {
        process.on(signal, () => {
            logger.info(`Notification worker received ${signal} - finishing current tick before exiting`)
            stopNotificationWorker()
        })
    })

    logger.info('Notification worker started')
    await runNotificationWorker()
    await prisma.$disconnect()
    logger.info('Notification worker stopped')
}

main().catch(error => {
    logger.error(`Notification worker crashed: ${error}`)
    process.exitCode = 1
})
