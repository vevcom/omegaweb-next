import { Session } from '@/auth/session/Session'
import { ledgerTransactionAuth } from '@/services/ledger/transactions/auth'
import { describe, expect, test } from '@jest/globals'
import type { Permission } from '@/prisma-generated-pn-types'

const OWNER_ID = 1
const OTHER_ID = 2

const sessionWith = (permissions: Permission[]) => Session.fromJsObject({
    memberships: [],
    permissions,
    user: { id: OWNER_ID } as NonNullable<Parameters<typeof Session.fromJsObject>[0]['user']>,
})

const ownedAccount = { userId: OWNER_ID, groupIds: [] }
const foreignAccount = { userId: OTHER_ID, groupIds: [] }

describe('ledgerTransactionAuth.create', () => {
    const user = sessionWith(['LEDGER_USE'])
    const admin = sessionWith(['LEDGER_USE', 'LEDGER_ADMIN'])

    test('no debit entries takes only LEDGER_USE', () => {
        const authorizer = ledgerTransactionAuth.create({ debitLedgerAccountIds: [], debitAccounts: [] })
        expect(authorizer.auth(user).authorized).toBe(true)
        expect(authorizer.auth(sessionWith([])).authorized).toBe(false)
    })

    test('debiting your own account is allowed', () => {
        const authorizer = ledgerTransactionAuth.create({ debitLedgerAccountIds: [10], debitAccounts: [ownedAccount] })
        expect(authorizer.auth(user).authorized).toBe(true)
    })

    test('debiting the account of someone else takes LEDGER_ADMIN', () => {
        const authorizer = ledgerTransactionAuth.create({
            debitLedgerAccountIds: [10, 11],
            debitAccounts: [ownedAccount, foreignAccount],
        })
        expect(authorizer.auth(user).authorized).toBe(false)
        expect(authorizer.auth(admin).authorized).toBe(true)
    })

    test('a debit against an account that does not resolve takes LEDGER_ADMIN', () => {
        const noneResolved = ledgerTransactionAuth.create({ debitLedgerAccountIds: [999], debitAccounts: [] })
        expect(noneResolved.auth(user).authorized).toBe(false)
        expect(noneResolved.auth(admin).authorized).toBe(true)

        const oneMissing = ledgerTransactionAuth.create({ debitLedgerAccountIds: [10, 999], debitAccounts: [ownedAccount] })
        expect(oneMissing.auth(user).authorized).toBe(false)
    })

    test('the same account debited twice is still one account to own', () => {
        const authorizer = ledgerTransactionAuth.create({ debitLedgerAccountIds: [10, 10], debitAccounts: [ownedAccount] })
        expect(authorizer.auth(user).authorized).toBe(true)
    })
})
