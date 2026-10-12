import { Session } from '@/auth/session/Session'
import { hashAndEncryptPassword } from '@/auth/passwordHash'
import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { userOperations } from '@/services/users/operations'
import { userSchemas } from '@/services/users/schemas'
import { userPrivateSelection } from '@/services/users/constants'
import { describe, expect, test } from '@jest/globals'

// Sending mail does not work under jest, so these stay on the paths that send no verification mail:
// a refusal, or a switch to the Feide email, which Feide has already verified.

const password = 'riktig-passord-123'
let userCounter = 0

async function createUser({ withPassword }: { withPassword: boolean }) {
    const username = `ny-epost-${++userCounter}`
    const email = `${username}@example.com`
    const feideEmail = `feide-${username}@stud.ntnu.no`
    const user = await prisma.user.create({
        data: {
            username,
            email,
            emailVerified: new Date(),
            acceptedTerms: withPassword ? new Date() : null,
            bioParagraph: { create: {} },
            ledgerAccount: { create: { type: 'USER' } },
            feideAccount: { create: {
                id: `feide-sub-${username}`,
                email: feideEmail,
                expiresAt: new Date(),
                issuedAt: new Date(),
            } },
        },
        select: userPrivateSelection,
    })
    if (withPassword) {
        await prisma.credentials.create({
            data: { userId: user.id, username, email, passwordHash: await hashAndEncryptPassword(password) },
        })
    }
    return { user, feideEmail }
}

type TestUser = Awaited<ReturnType<typeof createUser>>

function changeEmail({ user, feideEmail }: TestUser, { by = user, currentPassword, permissions = [] }: {
    by?: TestUser['user'],
    currentPassword?: string,
    permissions?: 'USERS_ADMIN'[],
}) {
    return userOperations.registerNewEmail({
        params: { id: user.id },
        data: { email: feideEmail, currentPassword },
        session: Session.fromJsObject({ memberships: [], permissions, user: by }),
    })
}

async function emailOf({ user }: TestUser) {
    return (await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).email
}

describe('changing the email of a user', () => {
    test('takes the current password once the user has one', async () => {
        const testUser = await createUser({ withPassword: true })

        await expect(changeEmail(testUser, {})).rejects.toThrow(new Smorekopp('BAD PARAMETERS'))
        await expect(changeEmail(testUser, { currentPassword: 'feil-passord-123' }))
            .rejects.toThrow(new Smorekopp('BAD PARAMETERS'))
        expect(await emailOf(testUser)).toBe(testUser.user.email)

        expect(await changeEmail(testUser, { currentPassword: password }))
            .toEqual({ verified: true, email: testUser.feideEmail })
        expect(await emailOf(testUser)).toBe(testUser.feideEmail)
    })

    test('takes the password of the user from USERS_ADMIN too', async () => {
        const testUser = await createUser({ withPassword: true })
        const admin = await createUser({ withPassword: true })
        await expect(changeEmail(testUser, { by: admin.user, permissions: ['USERS_ADMIN'] }))
            .rejects.toThrow(new Smorekopp('BAD PARAMETERS'))
        expect(await emailOf(testUser)).toBe(testUser.user.email)
    })

    test('needs no password from a user still signing up', async () => {
        const testUser = await createUser({ withPassword: false })
        expect(await changeEmail(testUser, {})).toEqual({ verified: true, email: testUser.feideEmail })
    })

    test('lowercases and trims the email', () => {
        expect(userSchemas.registerNewEmail.parse({ email: '  Ny.Epost@Example.COM ' }).email)
            .toBe('ny.epost@example.com')
    })
})
