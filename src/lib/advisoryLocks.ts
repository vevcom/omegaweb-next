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

/**
 * The keys of the advisory locks taken on one row, as the first half of a two-key lock whose second
 * half is the row's id. Two-key locks do not overlap the single keys above.
 */
const advisoryLockOnIdKeys = {
    eventRegistrations: 581_100,
} as const

/**
 * Takes the given lock on one id for the rest of the transaction, e.g. the registrations of one
 * event. Unlike `SELECT ... FOR UPDATE` it names no table, so it works in any schema.
 */
export async function takeAdvisoryLockOnId(
    tx: Prisma.TransactionClient,
    lock: keyof typeof advisoryLockOnIdKeys,
    id: number,
) {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(${advisoryLockOnIdKeys[lock]}::int, ${id}::int)`
}
