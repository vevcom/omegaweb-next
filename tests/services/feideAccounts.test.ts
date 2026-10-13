import { prisma } from '@/prisma-pn-client-instance'
import { feideAccountOperations } from '@/services/auth/feideAccounts/operations'
import { describe, expect, test } from '@jest/globals'

describe('feide accounts', () => {
    test('a Feide account is linked to its user, found by it, and keeps its email normalized', async () => {
        const user = await prisma.user.create({
            data: {
                username: 'feide-account-test',
                email: 'feide-account-test@omega.ntnu.no',
                bioParagraph: { create: {} },
                ledgerAccount: { create: { type: 'USER' } },
            },
            select: { id: true },
        })

        const created = await feideAccountOperations.create.internalCall({
            data: {
                id: 'feide-account-test-sub',
                userId: user.id,
                email: '  Feide-Account-Test@Stud.NTNU.no ',
                expiresAt: new Date(),
                issuedAt: new Date(),
            },
        })
        expect(created.email).toBe('feide-account-test@stud.ntnu.no')

        const linkedUser = await feideAccountOperations.readUser.internalCall({
            params: { feideAccountId: 'feide-account-test-sub' },
        })
        expect(linkedUser?.id).toBe(user.id)
        expect(await feideAccountOperations.readUser.internalCall({ params: { feideAccountId: 'no-such-sub' } }))
            .toBeNull()

        const updated = await feideAccountOperations.updateEmail.internalCall({
            params: { feideAccountId: 'feide-account-test-sub' },
            data: { email: 'New-Address@Stud.NTNU.no' },
        })
        expect(updated.email).toBe('new-address@stud.ntnu.no')
    })
})
