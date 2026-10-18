import seed from './src/seed'
import logger from '@/lib/logger'
import { prisma } from '@/prisma-pn-client-instance'
import { exit } from 'process'

process.env.SEED = 'true'

void seed({ devData: process.env.NODE_ENV === 'development' })
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (error) => {
        // Not every error that gets here is an Error - a driver adapter throws its own shape with
        // no `message`, and winston then logs the whole failure as "error: undefined". Pull out
        // something printable first, and keep the original as metadata.
        const message = error instanceof Error ? (error.stack ?? error.message) : String(error)
        logger.error(message, { error })
        await prisma.$disconnect()
        exit(1)
    }).then(() => logger.info('Seeding finished.'))
