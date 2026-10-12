import { Require } from '@/auth/authorizer/Require'
import { Session } from '@/auth/session/Session'
import { visibilityFilter } from '@/auth/visibility/visibilityFilter'
import { describe, expect, test } from '@jest/globals'
import type { MembershipFiltered } from '@/services/groups/types'
import type { Permission } from '@/prisma-generated-pn-types'

const memberships: MembershipFiltered[] = [{ groupId: 1, order: 1, active: true, admin: false }]
const expectedFilter = visibilityFilter(memberships)

const sessionWith = (permissions: Permission[]) => Session.fromJsObject({ user: null, permissions, memberships })
const visitor = sessionWith([])
const admin = sessionWith(['EVENT_ADMIN'])

/**
 * An operation reads a missing filter as "show everything", so a chain that loses the filter of
 * `.visibilityFilter()` lists rows the session may not see. Each case below is a shape of chain
 * where the filter has to survive - or, for the one holding the bypass, must not be attached.
 */
describe('Require.visibilityFilter', () => {
    test('on its own attaches the filter', () => {
        const result = Require.visibilityFilter().auth(visitor)
        expect(result.authorized).toBe(true)
        expect(result.prismaWhereFilter).toEqual(expectedFilter)
    })

    test('attaches no filter for the bypass permission', () => {
        const authorizer = Require.visibilityFilter({ bypassPermission: 'EVENT_ADMIN' })
        expect(authorizer.auth(admin).prismaWhereFilter).toBeUndefined()
        expect(authorizer.auth(visitor).prismaWhereFilter).toEqual(expectedFilter)
    })

    test('keeps the filter when a check follows it in the same group', () => {
        const result = Require.visibilityFilter().permission('EVENT_ADMIN').auth(admin)
        expect(result.authorized).toBe(true)
        expect(result.prismaWhereFilter).toEqual(expectedFilter)
    })

    test('keeps the filter when it is the group that passes after or()', () => {
        const authorizer = Require.permission('EVENT_ADMIN').or().visibilityFilter()

        const visitorResult = authorizer.auth(visitor)
        expect(visitorResult.authorized).toBe(true)
        expect(visitorResult.prismaWhereFilter).toEqual(expectedFilter)

        // The permission group passes without a filter, which grants unfiltered access.
        expect(authorizer.auth(admin).prismaWhereFilter).toBeUndefined()
    })

    test('the order of the groups does not matter', () => {
        const authorizer = Require.visibilityFilter().or().permission('EVENT_ADMIN')
        expect(authorizer.auth(visitor).prismaWhereFilter).toEqual(expectedFilter)
        expect(authorizer.auth(admin).prismaWhereFilter).toBeUndefined()
    })

    test('a failing group does not contribute its filter', () => {
        const authorizer = Require.visibilityFilter().permission('EVENT_ADMIN').or().user()
        const result = authorizer.auth(visitor)
        expect(result.authorized).toBe(false)
        expect(result.prismaWhereFilter).toBeUndefined()
    })
})
