import type { PrismaClient as PrismaClientPn } from '@/prisma-generated-pn-client'

/**
 * Re-points a table's id sequence past the highest id currently in it.
 *
 * Most of DobbelOmega lets postgres hand out ids, but a few tables migrate with the
 * Omegaweb-basic id written explicitly - either because the old id is the label users
 * read off the thing itself (a locker's number), or because it is the only natural key a
 * re-run can recognise a row by. An explicit insert does not advance the sequence, so
 * without this the first row the live site creates afterwards is handed an id that a
 * migrated row already holds. Call it once the table is done.
 * @param pnPrisma - PrismaClientPn
 * @param table - the unquoted table name, e.g. 'Ombul'. Interpolated into raw SQL, so it
 * is restricted to a bare identifier - only ever pass a literal from this codebase.
 */
export async function resyncIdSequence(pnPrisma: PrismaClientPn, table: string) {
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(table)) {
        throw new Error(`Refusing to resync sequence for unsafe table name "${table}"`)
    }

    // The third setval argument is is_called: false on an empty table so the sequence
    // still hands out 1 next, rather than burning it.
    await pnPrisma.$executeRawUnsafe(
        `SELECT setval(
            pg_get_serial_sequence('"${table}"', 'id'),
            COALESCE(MAX(id), 1),
            COALESCE(MAX(id), 0) > 0
        ) FROM "${table}"`
    )
}
