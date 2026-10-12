import { Require } from '@/auth/authorizer/Require'
import { Session } from '@/auth/session/Session'
import { describe, expect, test } from '@jest/globals'
import type { Authorizer } from '@/auth/authorizer/Authorizer'
import type { UserFiltered } from '@/services/users/types'

const user = { id: 1, username: 'harambe' } as UserFiltered
const loggedIn = Session.fromJsObject({ user, permissions: ['USERS_ADMIN'], memberships: [] })

type UserRequired = Authorizer<'USER_REQUIRED_FOR_AUTHORIZED'>

/**
 * A chain that only passes with a logged-in user says so in its type, so the session of an
 * authorized result has a `user` that is not null. The `@ts-expect-error` lines are part of the
 * test: `tsc` fails on any of them that stops being an error.
 */
describe('Require user guarantee', () => {
    test('a chain proving a user gives a session with a user', () => {
        const result = Require.user().auth(loggedIn)
        if (!result.authorized) throw new Error('expected to be authorized')

        const userId: number = result.session.user.id
        expect(userId).toBe(1)
    })

    test('userId and userField prove a user as well', () => {
        const byId: UserRequired = Require.userId().data({ userId: 1 })
        const byField: UserRequired = Require.userField().data({ userField: { username: 'harambe' } })
        const afterPermission: UserRequired = Require.permission('USERS_ADMIN').user()

        expect(byId.auth(loggedIn).authorized).toBe(true)
        expect(byField.auth(loggedIn).authorized).toBe(true)
        expect(afterPermission.auth(loggedIn).authorized).toBe(true)
    })

    test('a chain that may pass without a user gives a session that may lack one', () => {
        const result = Require.permission('USERS_ADMIN').auth(loggedIn)
        if (!result.authorized) throw new Error('expected to be authorized')

        // @ts-expect-error - `user` may be null
        const userId: number = result.session.user.id
        expect(userId).toBe(1)
    })

    test('every group has to prove a user for the chain to', () => {
        // @ts-expect-error - the permission group passes without a user
        const adminOrSelf: UserRequired = Require.permission('USERS_ADMIN').or().userId().data({ userId: 1 })
        const adminWithUser = Require.permission('USERS_ADMIN').user()
        const bothGroups: UserRequired = adminWithUser.or().userId().data({ userId: 1 })
        // @ts-expect-error - the group started by or() proves no user
        const newGroup: UserRequired = Require.user().or().permission('USERS_ADMIN')

        expect(adminOrSelf.auth(loggedIn).authorized).toBe(true)
        expect(bothGroups.auth(loggedIn).authorized).toBe(true)
        expect(newGroup.auth(loggedIn).authorized).toBe(true)
    })

    test('allOf proves a user if any builder does, anyOf only if all do', () => {
        const allOf: UserRequired = Require.allOf(Require.permission('USERS_ADMIN'), Require.user())
        const anyOfUsers: UserRequired = Require.anyOf(Require.user(), Require.userId()).data({ userId: 1 })
        // @ts-expect-error - the permission builder passes without a user
        const anyOfMixed: UserRequired = Require.anyOf(Require.permission('USERS_ADMIN'), Require.user())
        const chainedOntoUser: UserRequired = Require.user().anyOf(Require.permission('USERS_ADMIN'), Require.nothing())

        expect(allOf.auth(loggedIn).authorized).toBe(true)
        expect(anyOfUsers.auth(loggedIn).authorized).toBe(true)
        expect(anyOfMixed.auth(loggedIn).authorized).toBe(true)
        expect(chainedOntoUser.auth(loggedIn).authorized).toBe(true)
    })
})
