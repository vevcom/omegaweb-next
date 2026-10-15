import { Client } from 'pg'
import { URL } from 'url'

/**
 * The database migrated and seeded once per test run, which every test file gets a copy of.
 */
export const TEMPLATE_DATABASE = 'test-template'

/**
 * `DB_URI` pointing at another database on the same server.
 */
export function databaseUrl(database: string): string {
    if (!process.env.DB_URI) {
        throw new Error('Database URI not provided')
    }

    const url = new URL(process.env.DB_URI)
    url.pathname = `/${database}`

    return url.toString()
}

/**
 * Runs statements such as CREATE DATABASE through the database `DB_URI` points at, which is never
 * the template or a copy of it.
 */
export async function withAdminClient<T>(callback: (client: Client) => Promise<T>): Promise<T> {
    const client = new Client({ connectionString: process.env.DB_URI })
    await client.connect()
    try {
        return await callback(client)
    } finally {
        await client.end()
    }
}
