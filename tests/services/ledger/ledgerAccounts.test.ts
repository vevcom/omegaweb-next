import { Session } from '@/auth/session/Session'
import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { userOperations } from '@/services/users/operations'
import { describe, expect, test } from '@jest/globals'
import type { SessionMaybeUser } from '@/auth/session/Session'
import type { Permission } from '@/prisma-generated-pn-types'

type SessionUser = NonNullable<Parameters<typeof Session.fromJsObject>[0]['user']>

const sessionOf = (userId: number, permissions: Permission[]): SessionMaybeUser => Session.fromJsObject({
    memberships: [],
    permissions,
    user: { id: userId } as SessionUser,
})

async function createUserWithAccount(username: string) {
    const user = await userOperations.create({
        data: {
            email: `${username}@omega.ntnu.no`,
            firstname: 'Test',
            lastname: 'Testesen',
            username,
            emailVerified: new Date().toISOString(),
        },
        bypassAuth: true,
    })
    const account = await ledgerAccountOperations.read({ params: { userId: user.id }, bypassAuth: true })
    return { userId: user.id, accountId: account.id }
}

async function createManualGroup(shortName: string) {
    const { order } = await prisma.omegaOrder.findFirstOrThrow({ orderBy: { order: 'desc' } })
    const group = await prisma.group.create({
        data: {
            groupType: 'MANUAL_GROUP',
            order,
            manualGroup: { create: { name: shortName, shortName } },
        },
    })
    return group.id
}

describe('updating a ledger account', () => {
    test('an owner may set their own payout account number without LEDGER_ADMIN', async () => {
        const owner = await createUserWithAccount('payoutowner')

        const updated = await ledgerAccountOperations.update({
            params: { ledgerAccountId: owner.accountId },
            data: { payoutAccountNumber: '1234.56.78903', frozen: false },
            session: sessionOf(owner.userId, ['LEDGER_USE']),
        })

        expect(updated.payoutAccountNumber).toBe('1234.56.78903')
    })

    test('an owner may not change their account\'s group links without LEDGER_ADMIN', async () => {
        const owner = await createUserWithAccount('grouplinksowner')
        const groupId = await createManualGroup('ledger-account-test-group')

        await expect(ledgerAccountOperations.update({
            params: { ledgerAccountId: owner.accountId },
            data: { addGroupIds: [groupId], frozen: false },
            session: sessionOf(owner.userId, ['LEDGER_USE']),
        })).rejects.toThrow(new Smorekopp('UNAUTHORIZED'))

        await expect(ledgerAccountOperations.update({
            params: { ledgerAccountId: owner.accountId },
            data: { addGroupIds: [groupId], frozen: false },
            session: sessionOf(owner.userId, ['LEDGER_USE', 'LEDGER_ADMIN']),
        })).resolves.toBeDefined()
    })
})
