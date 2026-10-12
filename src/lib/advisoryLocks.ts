import '@pn-server-only'
import type { Prisma } from '@/prisma-generated-pn-types'

/**
 * The keys of the Postgres advisory locks the app takes. They share one key space across the whole
 * database, so every key is listed here and none may be reused.
 */
const advisoryLockKeys = {
    companySponsorTier: 581_000_001,
    cabinBooking: 581_000_002,
} as const

/**
 * Takes the given advisory lock for the rest of the transaction. Another transaction taking the
 * same lock waits until this one commits or rolls back.
 */
export async function takeAdvisoryLock(tx: Prisma.TransactionClient, lock: keyof typeof advisoryLockKeys) {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(${advisoryLockKeys[lock]}::bigint)`
}
