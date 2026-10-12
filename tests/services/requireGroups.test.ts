import { Require } from '@/auth/authorizer/Require'
import { Session } from '@/auth/session/Session'
import { describe, expect, test } from '@jest/globals'
import type { Permission } from '@/prisma-generated-pn-types'

const sessionWith = (...permissions: Permission[]) => Session.fromJsObject({ user: null, permissions, memberships: [] })

const eitherLedgerPermission = Require.anyOf(Require.permission('LEDGER_USE'), Require.permission('LEDGER_ADMIN'))
const cabinAdmin = Require.permission('CABIN_ADMIN')

/**
 * A chain is AND-groups OR'd together, and chaining extends the last group only. These pin down
 * the difference between chaining onto a chain of several groups and combining it from `Require`.
 */
describe('Require with several groups', () => {
    test('Require.allOf requires the extra builder of every group', () => {
        const authorizer = Require.allOf(eitherLedgerPermission, cabinAdmin)

        expect(authorizer.auth(sessionWith('LEDGER_USE')).authorized).toBe(false)
        expect(authorizer.auth(sessionWith('LEDGER_ADMIN')).authorized).toBe(false)
        expect(authorizer.auth(sessionWith('CABIN_ADMIN')).authorized).toBe(false)
        expect(authorizer.auth(sessionWith('LEDGER_USE', 'CABIN_ADMIN')).authorized).toBe(true)
        expect(authorizer.auth(sessionWith('LEDGER_ADMIN', 'CABIN_ADMIN')).authorized).toBe(true)
    })

    test('chaining allOf extends the last group only', () => {
        const authorizer = eitherLedgerPermission.allOf(cabinAdmin)

        expect(authorizer.auth(sessionWith('LEDGER_USE')).authorized).toBe(true)
        expect(authorizer.auth(sessionWith('LEDGER_ADMIN')).authorized).toBe(false)
        expect(authorizer.auth(sessionWith('LEDGER_ADMIN', 'CABIN_ADMIN')).authorized).toBe(true)
    })

    test('chaining a condition extends the last group only', () => {
        const authorizer = eitherLedgerPermission.permission('CABIN_ADMIN')

        expect(authorizer.auth(sessionWith('LEDGER_USE')).authorized).toBe(true)
        expect(authorizer.auth(sessionWith('LEDGER_ADMIN')).authorized).toBe(false)
    })

    test('or() followed by allOf ORs in a whole builder', () => {
        const authorizer = cabinAdmin.or().allOf(eitherLedgerPermission)

        expect(authorizer.auth(sessionWith('CABIN_ADMIN')).authorized).toBe(true)
        expect(authorizer.auth(sessionWith('LEDGER_USE')).authorized).toBe(true)
        expect(authorizer.auth(sessionWith('LEDGER_ADMIN')).authorized).toBe(true)
        expect(authorizer.auth(sessionWith()).authorized).toBe(false)
    })
})
