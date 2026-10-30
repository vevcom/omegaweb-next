import { Require } from '@/auth/authorizer/Require'
import { Session } from '@/auth/session/Session'
import { doubleLevelVisibilityFilter, visibilityFilter } from '@/auth/visibility/visibilityFilter'
import { describe, expect, test } from '@jest/globals'
import type { MembershipFiltered } from '@/services/groups/types'
import type { Permission } from '@/prisma-generated-pn-types'

const memberships: MembershipFiltered[] = [{ groupId: 1, order: 1, active: true, admin: false }]
const expectedFilter = doubleLevelVisibilityFilter(memberships, 'REGULAR')

const sessionWith = (permissions: Permission[]) => Session.fromJsObject({ user: null, permissions, memberships })
const visitor = sessionWith([])
const admin = sessionWith(['EVENT_ADMIN'])

describe('doubleLevelVisibilityFilter', () => {
    test('the admin filter matches the admin level alone', () => {
        expect(doubleLevelVisibilityFilter(memberships, 'ADMIN')).toEqual({
            visibilityAdmin: visibilityFilter(memberships),
        })
    })

    test('the regular filter matches either level, as passing the admin level passes the regular level', () => {
        expect(doubleLevelVisibilityFilter(memberships, 'REGULAR')).toEqual({
            OR: [
                { visibilityRegular: visibilityFilter(memberships) },
                { visibilityAdmin: visibilityFilter(memberships) },
            ],
        })
    })
})

/**
 * An operation reads a missing filter as "show everything", so a chain that loses the filter of
 * `.doubleLevelFilter()` lists rows the session may not see. Each case below is a shape of chain
 * where the filter has to survive - or, for the one holding the bypass, must not be attached.
 */
describe('Require.doubleLevelFilter', () => {
    test('on its own attaches the filter of its level', () => {
        const result = Require.doubleLevelFilter({ level: 'REGULAR' }).auth(visitor)
        expect(result.authorized).toBe(true)
        expect(result.prismaWhereFilter).toEqual(expectedFilter)

        expect(Require.doubleLevelFilter({ level: 'ADMIN' }).auth(visitor).prismaWhereFilter)
            .toEqual(doubleLevelVisibilityFilter(memberships, 'ADMIN'))
    })

    test('attaches no filter for the bypass permission', () => {
        const authorizer = Require.doubleLevelFilter({ level: 'REGULAR', bypassPermission: 'EVENT_ADMIN' })
        expect(authorizer.auth(admin).prismaWhereFilter).toBeUndefined()
        expect(authorizer.auth(visitor).prismaWhereFilter).toEqual(expectedFilter)
    })

    test('keeps the filter when a check follows it in the same group', () => {
        const result = Require.doubleLevelFilter({ level: 'REGULAR' }).permission('EVENT_ADMIN').auth(admin)
        expect(result.authorized).toBe(true)
        expect(result.prismaWhereFilter).toEqual(expectedFilter)
    })

    test('keeps the filter when it is the group that passes after or()', () => {
        const authorizer = Require.permission('EVENT_ADMIN').or().doubleLevelFilter({ level: 'REGULAR' })

        const visitorResult = authorizer.auth(visitor)
        expect(visitorResult.authorized).toBe(true)
        expect(visitorResult.prismaWhereFilter).toEqual(expectedFilter)

        // The permission group passes without a filter, which grants unfiltered access.
        expect(authorizer.auth(admin).prismaWhereFilter).toBeUndefined()
    })

    test('the order of the groups does not matter', () => {
        const authorizer = Require.doubleLevelFilter({ level: 'REGULAR' }).or().permission('EVENT_ADMIN')
        expect(authorizer.auth(visitor).prismaWhereFilter).toEqual(expectedFilter)
        expect(authorizer.auth(admin).prismaWhereFilter).toBeUndefined()
    })

    test('a failing group does not contribute its filter', () => {
        const authorizer = Require.doubleLevelFilter({ level: 'REGULAR' }).permission('EVENT_ADMIN').or().user()
        const result = authorizer.auth(visitor)
        expect(result.authorized).toBe(false)
        expect(result.prismaWhereFilter).toBeUndefined()
    })
})

describe('Require.filter with data', () => {
    test('builds the filter from the session and the data supplied', () => {
        const authorizer = Require.filter<{ onlyMine: boolean }, { onlyMine: boolean }>(
            ({ onlyMine }) => ({ onlyMine })
        )
        expect(authorizer.data({ onlyMine: true }).auth(visitor).prismaWhereFilter).toEqual({ onlyMine: true })
    })
})
