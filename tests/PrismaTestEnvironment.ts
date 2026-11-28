import { TEMPLATE_DATABASE, databaseUrl, withAdminClient } from './testDatabase'
import { v4 } from 'uuid'
import NodeEnvironment from 'jest-environment-node'
import type { EnvironmentContext, JestEnvironmentConfig } from '@jest/environment'

/**
 * A custom Jest environment that gives each test file its own copy of the seeded template database
 * (see `globalSetup.ts`), so concurrent files never share data. A file with `@timezone <zone>` in its
 * first comment runs in that zone, as a browser there does, which a test cannot set itself since its
 * `process.env` is a copy.
 */
export default class PrismaTestEnvironment extends NodeEnvironment {
    database: string
    timezone: string | undefined
    hostTimezone: string | undefined

    constructor(config: JestEnvironmentConfig, context: EnvironmentContext) {
        super(config, context)

        this.database = `test-${v4()}`
        this.global.process.env.DB_URI = databaseUrl(this.database)
        const { timezone } = context.docblockPragmas
        this.timezone = typeof timezone === 'string' ? timezone : undefined
    }

    async setup() {
        await withAdminClient(client => client.query(
            `CREATE DATABASE "${this.database}" TEMPLATE "${TEMPLATE_DATABASE}"`
        ))
        if (this.timezone) {
            this.hostTimezone = process.env.TZ
            process.env.TZ = this.timezone
        }

        return super.setup()
    }

    async teardown() {
        await withAdminClient(client => client.query(`DROP DATABASE IF EXISTS "${this.database}" WITH (FORCE)`))
        if (this.timezone) {
            if (this.hostTimezone === undefined) Reflect.deleteProperty(process.env, 'TZ')
            else process.env.TZ = this.hostTimezone
        }

        return super.teardown()
    }
}
