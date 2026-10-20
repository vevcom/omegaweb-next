import dobbelOmega from './dobbelOmega'
import seed from '@/seeder/src/seed'
import { createTimedStep } from '@/seeder/src/timedStep'
import { withServiceContext } from '@/services/serviceOperation'
import { Session } from '@/auth/session/Session'
import logger from '@/lib/logger'
import { prisma } from '@/prisma-pn-client-instance'
import { exit } from 'process'

// The entry point of `npm run dobbelOmega:run`, which has already reset the database. The import
// builds on the standard data, so that is upserted first; the development data is not, an import
// replaces it.
process.env.SEED = 'true'

const { step, finish } = createTimedStep(true)

seed({ devData: false })
    .then(() => step('Migrating from Omegaweb-basic', () => withServiceContext({
        bypassAuth: true,
        session: Session.empty(),
    }, true, async ({ prisma: pnPrisma }) => dobbelOmega(pnPrisma))))
    .then(async () => {
        finish()
        await prisma.$disconnect()
    })
    .catch(async (error: unknown) => {
        const message = error instanceof Error ? (error.stack ?? error.message) : String(error)
        logger.error(message, { error })
        await prisma.$disconnect()
        exit(1)
    })
