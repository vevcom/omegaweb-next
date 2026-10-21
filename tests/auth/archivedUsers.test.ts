import { loginReachesArchivedUser } from '@/auth/nextAuth/archivedUsers'
import { prisma } from '@/prisma-pn-client-instance'
import { describe, expect, test } from '@jest/globals'

let userCounter = 0

async function createUser({ archived }: { archived: boolean }) {
    const username = `archived-login-${++userCounter}`
    return prisma.user.create({
        data: {
            username,
            email: `${username}@stud.ntnu.no`,
            archived,
            bioParagraph: { create: {} },
            ledgerAccount: { create: { type: 'USER' } },
        },
    })
}

describe('a login that reaches an archived user', () => {
    test('is detected for a password login', async () => {
        const user = await createUser({ archived: true })
        expect(await loginReachesArchivedUser(prisma, { userId: user.id })).toBe(true)
    })

    test('is detected for a Feide login through the linked Feide account', async () => {
        const user = await createUser({ archived: true })
        await prisma.feideAccount.create({ data: {
            id: `feide-sub-${user.username}`,
            email: user.email,
            expiresAt: new Date(),
            issuedAt: new Date(),
            userId: user.id,
        } })
        expect(await loginReachesArchivedUser(prisma, {
            feideAccountId: `feide-sub-${user.username}`,
            email: 'annen-epost@stud.ntnu.no',
        })).toBe(true)
    })

    test('is detected for a Feide login through the email of the user', async () => {
        const user = await createUser({ archived: true })
        expect(await loginReachesArchivedUser(prisma, { feideAccountId: 'ukjent-sub', email: user.email })).toBe(true)
    })

    test('is not detected for a user that is not archived', async () => {
        const user = await createUser({ archived: false })
        expect(await loginReachesArchivedUser(prisma, { userId: user.id })).toBe(false)
        expect(await loginReachesArchivedUser(prisma, { feideAccountId: 'ukjent-sub', email: user.email })).toBe(false)
    })
})
