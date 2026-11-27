import { Require } from '@/auth/authorizer/Require'
import { Session } from '@/auth/session/Session'
import { describe, expect, test } from '@jest/globals'

describe('Require data', () => {
    test('a session among the data does not replace the session that is checked', () => {
        const rule = Require.permission('OMEGAQUOTES_USE').or().groupAdmin()
        const forged = Session.fromJsObject({ user: null, permissions: ['OMEGAQUOTES_USE'], memberships: [] })
        const data = { groupId: 1, session: forged }

        expect(rule.data(data).auth(Session.empty()).authorized).toBe(false)
        expect(rule.data(data).auth(forged).authorized).toBe(true)
    })
})
