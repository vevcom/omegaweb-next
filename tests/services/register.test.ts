import { Session } from '@/auth/session/Session'
import { userOperations } from '@/services/users/operations'
import { prisma } from '@/prisma-pn-client-instance'
import { describe, expect, test } from '@jest/globals'

async function createUnregisteredUser(username: string, emailVerified: string | null) {
    const user = await userOperations.create({
        data: {
            email: `${username}@example.com`,
            firstname: 'Test',
            lastname: 'Testesen',
            username,
            emailVerified,
        },
        bypassAuth: true,
    })

    return {
        user,
        session: Session.fromJsObject({ user, permissions: [], memberships: [] }),
    }
}

const registrationData = {
    password: 'EtVeldigLangtPassord1',
    confirmPassword: 'EtVeldigLangtPassord1',
    mobile: '12345678',
    acceptedTerms: true,
}

describe('register', () => {
    test('refuses a user whose email is not verified', async () => {
        const { user, session } = await createUnregisteredUser('registerunverified', null)

        await expect(userOperations.register({
            params: { id: user.id },
            data: registrationData,
            session,
        })).rejects.toMatchObject({ errorCode: 'DISSALLOWED' })

        const stored = await prisma.user.findUniqueOrThrow({
            where: { id: user.id },
            select: { acceptedTerms: true, credentials: true },
        })
        expect(stored.acceptedTerms).toBeNull()
        expect(stored.credentials).toBeNull()
    })

    test('registers a user whose email is verified', async () => {
        const { user, session } = await createUnregisteredUser('registerverified', new Date().toISOString())

        await userOperations.register({
            params: { id: user.id },
            data: registrationData,
            session,
        })

        const stored = await prisma.user.findUniqueOrThrow({
            where: { id: user.id },
            select: { acceptedTerms: true },
        })
        expect(stored.acceptedTerms).not.toBeNull()
    })
})
