import { TEMPLATE_DATABASE, databaseUrl, withAdminClient } from './testDatabase'
import { v4 } from 'uuid'
import NodeEnvironment from 'jest-environment-node'
import type { EnvironmentContext, JestEnvironmentConfig } from '@jest/environment'

/**
 * A custom Jest environment that gives each test file its own copy of the seeded template database
 * (see `globalSetup.ts`), so concurrent files never share data.
 */
export default class PrismaTestEnvironment extends NodeEnvironment {
    database: string

    constructor(config: JestEnvironmentConfig, context: EnvironmentContext) {
        super(config, context)

        this.database = `test-${v4()}`
        this.global.process.env.DB_URI = databaseUrl(this.database)
    }

    async setup() {
        await withAdminClient(client => client.query(
            `CREATE DATABASE "${this.database}" TEMPLATE "${TEMPLATE_DATABASE}"`
        ))

        return super.setup()
    }

    async teardown() {
        await withAdminClient(client => client.query(`DROP DATABASE IF EXISTS "${this.database}" WITH (FORCE)`))

        return super.teardown()
    }
}
