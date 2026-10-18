import logger from '@/lib/logger'
import { PrismaClient } from '@/prisma-generated-pn-client'
import { getContext } from '@/services/serviceOperation'
import { PrismaPg } from '@prisma/adapter-pg'

// To prevent hot reloading from creating new instances of PrismaClient it is stored in the global object.
// Read more about it in the section 'Prevent hot reloading from creating new instances of PrismaClient' here:
// https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections

function newPrisma() {
    const prisma = new PrismaClient({
        log: [
            {
                emit: 'event',
                level: 'query',
            },
            {
                emit: 'event',
                level: 'error',
            },
            {
                emit: 'event',
                level: 'info',
            },
            {
                emit: 'event',
                level: 'warn',
            },
        ],
        adapter: new PrismaPg(
            { connectionString: process.env.DB_URI },
            { schema: process.env.DB_SCHEMA },
        )
    })
    prisma.$on('query', (e) => {
        const context = getContext()
        // Sets select query to silly as it generates an unreasonable amount of logs.
        if (e.query.includes('SELECT')) {
            logger.silly('Prisma', {
                query: e.query,
                duration: e.duration,
                userName: context?.session.user?.username,
                userId: context?.session.user?.id,
                apiKey: context?.session.apiKeyId,
                bypassAuth: context?.bypassAuth
            })
        } else {
            logger.debug('Prisma', {
                query: e.query,
                duration: e.duration,
                userName: context?.session.user?.username,
                userId: context?.session.user?.id,
                apiKey: context?.session.apiKeyId,
                bypassAuth: context?.bypassAuth
            })
        }
    })

    prisma.$on('error', (e) => {
        const context = getContext()
        logger.error('Prisma', {
            message: e.message,
            userName: context?.session.user?.username,
            userId: context?.session.user?.id,
            apiKey: context?.session.apiKeyId,
            bypassAuth: context?.bypassAuth
        })
    })

    prisma.$on('info', (e) => {
        const context = getContext()
        logger.info('Prisma', {
            message: e.message,
            userName: context?.session.user?.username,
            userId: context?.session.user?.id,
            apiKey: context?.session.apiKeyId,
            bypassAuth: context?.bypassAuth
        })
    })

    prisma.$on('warn', (e) => {
        const context = getContext()
        logger.warn('Prisma', {
            message: e.message,
            userName: context?.session.user?.username,
            userId: context?.session.user?.id,
            apiKey: context?.session.apiKeyId,
            bypassAuth: context?.bypassAuth
        })
    })

    return prisma
}

// This is how the Prisma docs recommend doing it
const globalForPrisma = global as unknown as {
    prisma: ReturnType<typeof newPrisma>
}

export const prisma = globalForPrisma.prisma || newPrisma()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
