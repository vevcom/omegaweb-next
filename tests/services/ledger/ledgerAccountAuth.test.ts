import { Session } from '@/auth/session/Session'
import { ledgerAccountAuth } from '@/services/ledger/accounts/auth'
import { describe, expect, test } from '@jest/globals'
import type { Permission } from '@/prisma-generated-pn-types'

const OWNER_ID = 1

const sessionWith = (permissions: Permission[]) => Session.fromJsObject({
    memberships: [],
    permissions,
    user: { id: OWNER_ID } as NonNullable<Parameters<typeof Session.fromJsObject>[0]['user']>,
})

const ownedAccount = { userId: OWNER_ID, groupIds: [] }
const foreignAccount = { userId: OWNER_ID + 1, groupIds: [] }

describe('ledgerAccountAuth.read', () => {
    const owner = sessionWith([])
    const admin = sessionWith(['LEDGER_ADMIN'])

    test('takes ownership of every account, or LEDGER_ADMIN', () => {
        expect(ledgerAccountAuth.read.data({ accounts: [ownedAccount] }).auth(owner).authorized).toBe(true)

        const withForeign = ledgerAccountAuth.read.data({ accounts: [ownedAccount, foreignAccount] })
        expect(withForeign.auth(owner).authorized).toBe(false)
        expect(withForeign.auth(admin).authorized).toBe(true)
    })

    test('no accounts at all takes LEDGER_ADMIN', () => {
        const authorizer = ledgerAccountAuth.read.data({ accounts: [] })
        expect(authorizer.auth(owner).authorized).toBe(false)
        expect(authorizer.auth(admin).authorized).toBe(true)
    })
})

describe('ledgerAccountAuth.update', () => {
    const owner = sessionWith(['LEDGER_USE'])
    const admin = sessionWith(['LEDGER_USE', 'LEDGER_ADMIN'])

    test('an owner may update their own account', () => {
        const authorizer = ledgerAccountAuth.update({ accounts: [ownedAccount], changesGroupLinks: false })
        expect(authorizer.auth(owner).authorized).toBe(true)
        expect(authorizer.auth(sessionWith([])).authorized).toBe(false)
    })

    test('the account of someone else takes LEDGER_ADMIN', () => {
        const authorizer = ledgerAccountAuth.update({ accounts: [foreignAccount], changesGroupLinks: false })
        expect(authorizer.auth(owner).authorized).toBe(false)
        expect(authorizer.auth(admin).authorized).toBe(true)
    })

    test('changing group links takes LEDGER_ADMIN even of the owner', () => {
        const authorizer = ledgerAccountAuth.update({ accounts: [ownedAccount], changesGroupLinks: true })
        expect(authorizer.auth(owner).authorized).toBe(false)
        expect(authorizer.auth(admin).authorized).toBe(true)
        expect(authorizer.auth(sessionWith(['LEDGER_ADMIN'])).authorized).toBe(false)
    })
})
