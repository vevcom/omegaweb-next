import type { Prisma } from '@/prisma-generated-pn-types'

/**
 * Takes the next id of a table from its sequence, for a row that has to know its id before it is
 * inserted, such as one that is its own parent or that rows it points to are named after. The
 * sequence hands an id out once, so no later autoincremented insert gets the same one.
 */
export async function reserveId(prisma: Prisma.TransactionClient, table: string): Promise<number> {
    // The table is qualified with the schema the prisma adapter is given (see client.ts): the
    // adapter qualifies its own queries but leaves search_path alone, so an unqualified name in raw
    // SQL resolves against public, which is not where the tables are in e.g. the test schemas.
    const schema = (process.env.DB_SCHEMA ?? 'public').replace(/"/g, '""')
    const [{ id }] = await prisma.$queryRaw<{ id: bigint }[]>`
        SELECT nextval(pg_get_serial_sequence(${`"${schema}"."${table}"`}, 'id')) AS id
    `
    return Number(id)
}
