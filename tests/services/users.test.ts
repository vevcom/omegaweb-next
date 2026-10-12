import { Session } from '@/auth/session/Session'
import { ParseError, Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { userOperations } from '@/services/users/operations'
import { decryptAndComparePassword } from '@/auth/passwordHash'
import { describe, expect, test } from '@jest/globals'

const PASSWORD = 'et-godt-passord-123'

/** A user invited with a verified email, who has not registered yet. */
async function createInvitedUser(username: string) {
    return userOperations.create({
        data: {
            email: `${username}@omega.ntnu.no`,
            firstname: 'Test',
            lastname: 'Testesen',
            username,
            emailVerified: new Date().toISOString(),
        },
        bypassAuth: true,
    })
}

const sessionOf = (user: Awaited<ReturnType<typeof createInvitedUser>>) =>
    Session.fromJsObject({ user, permissions: [], memberships: [] })

const registrationData = (password = PASSWORD, confirmPassword = password) => ({
    mobile: '12345678',
    allergies: 'Ingen',
    password,
    confirmPassword,
    sex: 'OTHER' as const,
    imageConsent: true,
    acceptedTerms: true,
})

async function passwordMatches(userId: number, password: string) {
    const credentials = await prisma.credentials.findUnique({ where: { userId } })
    return credentials !== null && await decryptAndComparePassword(password, credentials.passwordHash)
}

async function isRegistered(userId: number) {
    const user = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { acceptedTerms: true, credentials: { select: { userId: true } } },
    })
    return user.acceptedTerms !== null || user.credentials !== null
}

describe('register', () => {
    test('accepts the terms, stores the details and sets the password', async () => {
        const user = await createInvitedUser('registerone')

        const registered = await userOperations.register({
            params: { id: user.id },
            data: registrationData(),
            session: sessionOf(user),
        })

        expect(registered.acceptedTerms).toBeInstanceOf(Date)
        expect(registered).toMatchObject({ mobile: '12345678', allergies: 'Ingen', sex: 'OTHER', imageConsent: true })
        expect(await passwordMatches(user.id, PASSWORD)).toBe(true)
    })

    test('the password is not stored in plain text', async () => {
        const user = await createInvitedUser('registertwo')

        await userOperations.register({
            params: { id: user.id },
            data: registrationData(),
            session: sessionOf(user),
        })

        const credentials = await prisma.credentials.findUniqueOrThrow({ where: { userId: user.id } })
        expect(credentials.passwordHash).not.toContain(PASSWORD)
    })

    test('a user can only register once', async () => {
        const user = await createInvitedUser('registerthree')

        await userOperations.register({
            params: { id: user.id },
            data: registrationData(),
            session: sessionOf(user),
        })

        await expect(userOperations.register({
            params: { id: user.id },
            data: registrationData('et-annet-passord-123'),
            session: sessionOf(user),
        })).rejects.toThrow(new Smorekopp('DUPLICATE'))

        expect(await passwordMatches(user.id, PASSWORD)).toBe(true)
    })

    test('a user cannot register someone else', async () => {
        const user = await createInvitedUser('registerfour')
        const other = await createInvitedUser('registerfourother')

        await expect(userOperations.register({
            params: { id: user.id },
            data: registrationData(),
            session: sessionOf(other),
        })).rejects.toThrow(new Smorekopp('UNAUTHORIZED'))

        await expect(userOperations.register({
            params: { id: user.id },
            data: registrationData(),
            session: Session.empty(),
        })).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))

        expect(await isRegistered(user.id)).toBe(false)
    })

    test('the passwords must match, and the terms must be accepted', async () => {
        const user = await createInvitedUser('registerfive')

        await expect(userOperations.register({
            params: { id: user.id },
            data: registrationData(PASSWORD, 'et-annet-passord-123'),
            session: sessionOf(user),
        })).rejects.toThrow(ParseError)

        await expect(userOperations.register({
            params: { id: user.id },
            data: { ...registrationData(), acceptedTerms: false },
            session: sessionOf(user),
        })).rejects.toThrow(ParseError)

        await expect(userOperations.register({
            params: { id: user.id },
            data: registrationData('kort'),
            session: sessionOf(user),
        })).rejects.toThrow(ParseError)

        expect(await isRegistered(user.id)).toBe(false)
    })
})

describe('updatePassword', () => {
    async function createRegisteredUser(username: string) {
        const user = await createInvitedUser(username)
        await userOperations.register({
            params: { id: user.id },
            data: registrationData(),
            session: sessionOf(user),
        })
        return user
    }

    const newPassword = 'et-nytt-passord-456'

    test('a user can change their own password', async () => {
        const user = await createRegisteredUser('passwordone')
        const before = await prisma.credentials.findUniqueOrThrow({ where: { userId: user.id } })

        await userOperations.updatePassword({
            params: { id: user.id },
            data: { password: newPassword, confirmPassword: newPassword },
            session: sessionOf(user),
        })

        expect(await passwordMatches(user.id, newPassword)).toBe(true)
        expect(await passwordMatches(user.id, PASSWORD)).toBe(false)

        // Outstanding reset password tokens are checked against this.
        const after = await prisma.credentials.findUniqueOrThrow({ where: { userId: user.id } })
        expect(after.credentialsUpdatedAt.getTime()).toBeGreaterThan(before.credentialsUpdatedAt.getTime())
    })

    test('a user cannot change the password of someone else', async () => {
        const user = await createRegisteredUser('passwordtwo')
        const other = await createInvitedUser('passwordtwoother')

        await expect(userOperations.updatePassword({
            params: { id: user.id },
            data: { password: newPassword, confirmPassword: newPassword },
            session: sessionOf(other),
        })).rejects.toThrow(new Smorekopp('UNAUTHORIZED'))

        await expect(userOperations.updatePassword({
            params: { id: user.id },
            data: { password: newPassword, confirmPassword: newPassword },
            session: Session.empty(),
        })).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))

        expect(await passwordMatches(user.id, PASSWORD)).toBe(true)
    })

    test('the new password must be long enough and typed the same twice', async () => {
        const user = await createRegisteredUser('passwordthree')

        await expect(userOperations.updatePassword({
            params: { id: user.id },
            data: { password: newPassword, confirmPassword: 'et-annet-passord-789' },
            session: sessionOf(user),
        })).rejects.toThrow(ParseError)

        await expect(userOperations.updatePassword({
            params: { id: user.id },
            data: { password: 'kort', confirmPassword: 'kort' },
            session: sessionOf(user),
        })).rejects.toThrow(ParseError)

        expect(await passwordMatches(user.id, PASSWORD)).toBe(true)
    })
})
