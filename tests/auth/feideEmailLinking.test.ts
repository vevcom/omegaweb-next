import { feideLoginMayLinkByEmail } from '@/auth/nextAuth/feideEmailLinking'
import { prisma } from '@/prisma-pn-client-instance'
import { describe, expect, test } from '@jest/globals'

let userCounter = 0

async function createUser({ withPassword = false }: { withPassword?: boolean } = {}) {
    const username = `feide-link-${++userCounter}`
    const email = `${username}@stud.ntnu.no`
    const user = await prisma.user.create({
        data: {
            username,
            email,
            bioParagraph: { create: {} },
            ledgerAccount: { create: { type: 'USER' } },
        },
    })
    if (withPassword) {
        await prisma.credentials.create({
            data: { userId: user.id, username, email, passwordHash: 'not-a-real-hash' },
        })
    }
    return user
}

function loginOf(email: string, realms: string[] = []) {
    return {
        providerAccountId: `feide-sub-${email}`,
        email,
        readRealms: async () => realms,
    }
}

describe('linking a Feide login to an existing user by email', () => {
    test('links an unclaimed user when the Feide user studies at an allowed institution', async () => {
        const user = await createUser()
        expect(await feideLoginMayLinkByEmail(prisma, loginOf(user.email, ['ntnu.no']))).toBe(true)
    })

    test('refuses a Feide user from another institution', async () => {
        const user = await createUser()
        expect(await feideLoginMayLinkByEmail(prisma, loginOf(user.email, ['uio.no']))).toBe(false)
    })

    test('refuses a Feide user with no study programme', async () => {
        const user = await createUser()
        expect(await feideLoginMayLinkByEmail(prisma, loginOf(user.email))).toBe(false)
    })

    test('refuses a user that has a password', async () => {
        const user = await createUser({ withPassword: true })
        expect(await feideLoginMayLinkByEmail(prisma, loginOf(user.email, ['ntnu.no']))).toBe(false)
    })

    test('refuses a user that already has a Feide account', async () => {
        const user = await createUser()
        await prisma.feideAccount.create({ data: {
            id: `other-sub-${user.id}`,
            email: `other-${user.email}`,
            expiresAt: new Date(),
            issuedAt: new Date(),
            userId: user.id,
        } })
        expect(await feideLoginMayLinkByEmail(prisma, loginOf(user.email, ['ntnu.no']))).toBe(false)
    })

    test('lets a new email through to create a new user, whatever the realm', async () => {
        expect(await feideLoginMayLinkByEmail(prisma, loginOf('ny-bruker@uio.no', ['uio.no']))).toBe(true)
    })

    test('lets an already linked Feide account log in', async () => {
        const user = await createUser({ withPassword: true })
        const login = loginOf(user.email, ['uio.no'])
        await prisma.feideAccount.create({ data: {
            id: login.providerAccountId,
            email: user.email,
            expiresAt: new Date(),
            issuedAt: new Date(),
            userId: user.id,
        } })
        expect(await feideLoginMayLinkByEmail(prisma, login)).toBe(true)
    })
})
