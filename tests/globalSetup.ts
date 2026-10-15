import { TEMPLATE_DATABASE, databaseUrl, withAdminClient } from './testDatabase'
import { execSync } from 'child_process'

/**
 * Migrates and seeds the template database once, so a test file only has to copy it instead of
 * pushing the schema and seeding on its own.
 */
export default async function globalSetup() {
    await withAdminClient(async client => {
        await client.query(`DROP DATABASE IF EXISTS "${TEMPLATE_DATABASE}" WITH (FORCE)`)
        await client.query(`CREATE DATABASE "${TEMPLATE_DATABASE}"`)
    })

    const env = { ...process.env, DB_URI: databaseUrl(TEMPLATE_DATABASE), IGNORE_SERVER_ONLY: 'true' }
    try {
        execSync(`npx prisma db push --url ${env.DB_URI}`, { env, stdio: 'pipe' })
        execSync('npx tsx tests/seedTemplate.ts', { env, stdio: 'pipe' })
    } catch (error) {
        const { stdout, stderr } = error as { stdout?: Buffer, stderr?: Buffer }
        console.error(stdout?.toString(), stderr?.toString())
        throw error
    }
}
