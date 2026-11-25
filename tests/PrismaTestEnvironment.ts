import { TEMPLATE_DATABASE, databaseUrl, withAdminClient } from './testDatabase'
import { v4 } from 'uuid'
import NodeEnvironment from 'jest-environment-node'
import type { EnvironmentContext, JestEnvironmentConfig } from '@jest/environment'

/**
 * A custom Jest environment that gives each test file its own copy of the seeded template database
 * (see `globalSetup.ts`), so concurrent files never share data.
 *
 * A file runs in another time zone than the machine's with `@jest-environment-options
 * {"timeZone": "Europe/Oslo"}` in its docblock.
 */
export default class PrismaTestEnvironment extends NodeEnvironment {
    database: string
    timeZone: string | undefined
    timeZoneOutside: string | undefined

    constructor(config: JestEnvironmentConfig, context: EnvironmentContext) {
        super(config, context)

        this.database = `test-${v4()}`
        this.global.process.env.DB_URI = databaseUrl(this.database)
        const { timeZone } = config.projectConfig.testEnvironmentOptions
        this.timeZone = typeof timeZone === 'string' ? timeZone : undefined
    }

    async setup() {
        await withAdminClient(client => client.query(
            `CREATE DATABASE "${this.database}" TEMPLATE "${TEMPLATE_DATABASE}"`
        ))
        // The test sees a copy of the environment variables, so the zone is set on the worker's own.
        if (this.timeZone) {
            this.timeZoneOutside = process.env.TZ
            process.env.TZ = this.timeZone
        }

        return super.setup()
    }

    async teardown() {
        await withAdminClient(client => client.query(`DROP DATABASE IF EXISTS "${this.database}" WITH (FORCE)`))
        if (this.timeZone) {
            if (this.timeZoneOutside === undefined) Reflect.deleteProperty(process.env, 'TZ')
            else process.env.TZ = this.timeZoneOutside
        }

        return super.teardown()
    }
}
