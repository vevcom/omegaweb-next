import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { authOperations } from '@/services/auth/operations'
import { userOperations } from '@/services/users/operations'
import { generateJWT } from '@/lib/jwt/jwt'
import { JWT_ISSUER } from '@/lib/jwt/constants'
import { emailValidationExpiration } from '@/lib/email/systemMail/constants'
import { decryptAndComparePassword, hashAndEncryptPassword } from '@/auth/passwordHash'
import { describe, expect, test } from '@jest/globals'
import { sign } from 'jsonwebtoken'

const OLD_PASSWORD = 'gammelt-passord-123'
const NEW_PASSWORD = 'nytt-passord-12345'

/**
 * A user whose user row and credentials were last changed an hour ago. Tokens are only valid if
 * issued after the last change, and their issue time is in whole seconds - so a user changed in
 * the same second as a token is issued would make that token look stale.
 */
async function createUserChangedAnHourAgo(username: string, { withPassword }: { withPassword: boolean }) {
    const user = await userOperations.create({
        data: {
            email: `${username}@omega.ntnu.no`,
            firstname: 'Test',
            lastname: 'Testesen',
            username,
        },
        bypassAuth: true,
    })

    const anHourAgo = new Date(Date.now() - 60 * 60 * 1000)

    if (withPassword) {
        await prisma.credentials.create({
            data: {
                user: { connect: { id: user.id } },
                passwordHash: await hashAndEncryptPassword(OLD_PASSWORD),
            },
        })
        await prisma.credentials.update({
            where: { userId: user.id },
            data: { credentialsUpdatedAt: anHourAgo },
        })
    }
    await prisma.user.update({ where: { id: user.id }, data: { updatedAt: anHourAgo } })

    return user
}

async function passwordMatches(userId: number, password: string) {
    const credentials = await prisma.credentials.findUniqueOrThrow({ where: { userId } })
    return decryptAndComparePassword(password, credentials.passwordHash)
}

const resetPassword = (token: string, password = NEW_PASSWORD) => authOperations.resetPassword({
    params: { token },
    data: { password, confirmPassword: password },
})

const resetPasswordToken = (userId: number, expiresIn = 60 * 60) =>
    generateJWT('resetpassword', { sub: userId }, expiresIn)

const verifyEmailToken = (userId: number, email: string, expiresIn = emailValidationExpiration) =>
    generateJWT('verifyemail', { sub: userId, email }, expiresIn)

describe('reset password', () => {
    test('a reset token is accepted and sets the new password', async () => {
        const user = await createUserChangedAnHourAgo('resetone', { withPassword: true })
        const token = resetPasswordToken(user.id)

        expect(await authOperations.verifyResetPasswordToken({ params: { token } })).toBe(user.id)

        await resetPassword(token)

        expect(await passwordMatches(user.id, NEW_PASSWORD)).toBe(true)
        expect(await passwordMatches(user.id, OLD_PASSWORD)).toBe(false)
    })

    test('a reset token can only be used once', async () => {
        const user = await createUserChangedAnHourAgo('resettwo', { withPassword: true })
        const token = resetPasswordToken(user.id)

        await resetPassword(token)

        await expect(authOperations.verifyResetPasswordToken({ params: { token } }))
            .rejects.toThrow(new Smorekopp('JWT INVALID'))
        await expect(resetPassword(token, 'enda-et-passord-123'))
            .rejects.toThrow(new Smorekopp('JWT INVALID'))
        expect(await passwordMatches(user.id, NEW_PASSWORD)).toBe(true)
    })

    test('a reset token issued before the password was last changed is refused', async () => {
        const user = await createUserChangedAnHourAgo('resetthree', { withPassword: true })
        const token = resetPasswordToken(user.id)

        await userOperations.updatePassword({
            params: { id: user.id },
            data: { password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD },
            bypassAuth: true,
        })

        await expect(resetPassword(token, 'enda-et-passord-123'))
            .rejects.toThrow(new Smorekopp('JWT INVALID'))
        expect(await passwordMatches(user.id, NEW_PASSWORD)).toBe(true)
    })

    test('an expired reset token is refused', async () => {
        const user = await createUserChangedAnHourAgo('resetfour', { withPassword: true })
        const token = resetPasswordToken(user.id, -60)

        await expect(resetPassword(token)).rejects.toThrow(new Smorekopp('JWT EXPIRED'))
        expect(await passwordMatches(user.id, OLD_PASSWORD)).toBe(true)
    })

    test('a token issued for something else is refused', async () => {
        const user = await createUserChangedAnHourAgo('resetfive', { withPassword: true })
        const token = verifyEmailToken(user.id, user.email)

        await expect(resetPassword(token)).rejects.toThrow(new Smorekopp('JWT INVALID'))
        expect(await passwordMatches(user.id, OLD_PASSWORD)).toBe(true)
    })

    test('a token not signed with the secret of the site is refused', async () => {
        const user = await createUserChangedAnHourAgo('resetsix', { withPassword: true })
        const token = sign({ sub: user.id }, 'not-the-secret-of-the-site', {
            audience: 'resetpassword',
            algorithm: 'HS256',
            issuer: JWT_ISSUER,
            expiresIn: 60 * 60,
        })

        await expect(resetPassword(token)).rejects.toThrow(new Smorekopp('JWT INVALID'))
        expect(await passwordMatches(user.id, OLD_PASSWORD)).toBe(true)
    })
})

describe('verify email', () => {
    test('a verification token confirms the address it was issued for', async () => {
        const user = await createUserChangedAnHourAgo('verifyone', { withPassword: false })
        expect(user.emailVerified).toBeNull()

        const verified = await authOperations.verifyEmail({
            params: { token: verifyEmailToken(user.id, user.email) },
        })

        expect(verified.email).toBe(user.email)
        const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
        expect(stored.emailVerified).toBeInstanceOf(Date)
    })

    test('a verification token for a new address moves the user onto it, verified', async () => {
        const user = await createUserChangedAnHourAgo('verifytwo', { withPassword: false })

        await authOperations.verifyEmail({
            params: { token: verifyEmailToken(user.id, 'verifytwo-ny@example.com') },
        })

        const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
        expect(stored.email).toBe('verifytwo-ny@example.com')
        expect(stored.emailVerified).toBeInstanceOf(Date)
    })

    test('a verification token is refused once the user has changed since it was issued', async () => {
        const user = await createUserChangedAnHourAgo('verifythree', { withPassword: false })
        const firstToken = verifyEmailToken(user.id, 'verifythree-forste@example.com')
        const secondToken = verifyEmailToken(user.id, 'verifythree-andre@example.com')

        await authOperations.verifyEmail({ params: { token: firstToken } })

        // Both tokens were issued before the first was used, so neither may be used again.
        await expect(authOperations.verifyEmail({ params: { token: secondToken } }))
            .rejects.toThrow(new Smorekopp('JWT INVALID'))
        await expect(authOperations.verifyEmail({ params: { token: firstToken } }))
            .rejects.toThrow(new Smorekopp('JWT INVALID'))

        const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
        expect(stored.email).toBe('verifythree-forste@example.com')
    })

    test('an expired verification token is refused', async () => {
        const user = await createUserChangedAnHourAgo('verifyfour', { withPassword: false })

        await expect(authOperations.verifyEmail({
            params: { token: verifyEmailToken(user.id, user.email, -60) },
        })).rejects.toThrow(new Smorekopp('JWT EXPIRED'))

        const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
        expect(stored.emailVerified).toBeNull()
    })

    test('a reset password token cannot verify an email', async () => {
        const user = await createUserChangedAnHourAgo('verifyfive', { withPassword: false })

        await expect(authOperations.verifyEmail({
            params: { token: resetPasswordToken(user.id) },
        })).rejects.toThrow(new Smorekopp('JWT INVALID'))

        const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
        expect(stored.emailVerified).toBeNull()
    })
})
