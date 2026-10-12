import { Require } from '@/auth/authorizer/Require'
import { Session } from '@/auth/session/Session'
import { defineOperation } from '@/services/serviceOperation'
import { describe, expect, test } from '@jest/globals'
import type { Authorizer } from '@/auth/authorizer/Authorizer'

const groupAdmin = Require.permission('COMMITTEE_ADMIN').or().groupAdmin()

/**
 * A chain that has not been given its data denies everyone it should let through, or throws, so
 * handing one over where an authorizer is expected has to fail to compile. The
 * `@ts-expect-error` lines are the test: `tsc` fails on any of them that stops being an error.
 */
describe('Require chain lacking data', () => {
    test('is not an Authorizer', () => {
        // @ts-expect-error - `groupId` has not been supplied
        const incomplete: Authorizer = groupAdmin
        const complete: Authorizer = groupAdmin.data({ groupId: 1 })

        expect(incomplete).toBeDefined()
        expect(complete).toBeDefined()
    })

    test('is not accepted by defineOperation', () => {
        defineOperation({
            // @ts-expect-error - `groupId` has not been supplied
            authorizer: () => groupAdmin,
            operation: async () => null,
        })
        const operation = defineOperation({
            authorizer: () => groupAdmin.data({ groupId: 1 }),
            operation: async () => null,
        })

        expect(operation).toBeDefined()
    })

    test('cannot be evaluated', () => {
        const session = Session.fromJsObject({ user: null, permissions: ['COMMITTEE_ADMIN'], memberships: [] })

        // @ts-expect-error - `groupId` has not been supplied
        groupAdmin.auth(session)

        expect(groupAdmin.data({ groupId: 1 }).auth(session).authorized).toBe(true)
    })
})
