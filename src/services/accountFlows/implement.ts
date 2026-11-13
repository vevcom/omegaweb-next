import '@pn-server-only'
import { accountSchemas } from './schemas'
import { defineOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import { Require } from '@/auth/authorizer/Require'
import { verifyJWT } from '@/lib/jwt/jwt'
import { Site } from '@/lib/sites/site'
import logger from '@/lib/logger'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client'
import type { PrismaPossibleTransaction } from '@/services/serviceOperation'
import type { OmegaJWTAudience } from '@/lib/jwt/types'
import type { Awaitable } from '@/lib/awaitable'
import type { z } from 'zod'

type Prisma = PrismaPossibleTransaction<false>

/**
 * A kind of account that signs in with a password and is reached at an email: a user, or a
 * company user. The steps of choosing a password by mail and of changing an email with
 * verification are the same for every kind, and are written once in {@link implementAccountFlows}.
 * What differs is where the account is stored, what its tokens are called and what its mails say,
 * and that is what a kind supplies.
 *
 * `Verified` is what the kind hands back of an account whose email was just verified.
 */
export type AccountKind<Verified extends { email: string }, PasswordSchema extends z.ZodTypeAny> = {
    /**
     * The audiences of the kind's tokens. Each kind has its own, so a token for one kind of account
     * can never act on the account with the same id of another kind.
     */
    audiences: {
        resetPassword: OmegaJWTAudience,
        verifyEmail: OmegaJWTAudience,
    },
    /** What a new password is given as and held to. */
    passwordSchema: PasswordSchema,
    /**
     * When the account's password was last set, null for an account that has none yet. Throws
     * NOT FOUND for an account that does not exist or may not sign in.
     */
    readCredentialsUpdatedAt: (prisma: Prisma, accountId: number) => Awaitable<Date | null>,
    /** Holds the account's row until the transaction ends, so neither its email nor its password changes meanwhile. */
    lockAccount: (prisma: Prisma, accountId: number) => Awaitable<unknown>,
    /** Sets the password, and ends the sessions started with the old one. */
    writePassword: (prisma: Prisma, accountId: number, data: z.output<PasswordSchema>) => Awaitable<void>,
    /** Marks `email` as verified, if it is the account's email and is not verified already. */
    markEmailVerified: (prisma: Prisma, accountId: number, email: string) => Awaitable<void>,
    /** The account's email as it stands. Throws NOT FOUND for an account that does not exist. */
    readEmail: (prisma: Prisma, accountId: number) => Awaitable<{ email: string, emailVerified: Date | null }>,
    /** Makes `email` the account's email, verified now. A taken email fails on the unique constraint. */
    writeVerifiedEmail: (prisma: Prisma, accountId: number, email: string) => Awaitable<Verified>,
    /** Tells the old address of the change, once it has happened. Must not throw. */
    notifyEmailChanged: (verified: Verified, oldEmail: string) => Awaitable<void>,
    /**
     * Sends the password link to the account with this email, and does nothing when there is none.
     * It is run without being awaited, so that how long it takes says nothing of whether there is one.
     */
    sendResetPasswordMail: (email: string, site: Site) => Promise<unknown>,
    messages: {
        /** A verify email link that was used, or is older than a later verification. */
        verifyEmailLinkSpent: string,
        /** The email of a verify email link has been taken by another account since it was sent. */
        emailTaken: string,
    },
}

/**
 * The operations of choosing a password by mail and of verifying an email, for one kind of account.
 * A valid token is the entire admission control of each, not the session: it is verified in the
 * operation itself.
 */
export function implementAccountFlows<Verified extends { email: string }, PasswordSchema extends z.ZodTypeAny>(
    kind: AccountKind<Verified, PasswordSchema>,
) {
    /** What a reset password link says of itself. Whether it still stands is for verifyResetPasswordToken. */
    function readResetPasswordToken(token: string) {
        const payload = verifyJWT(token, kind.audiences.resetPassword)

        if (!payload.sub || !payload.iat) {
            throw new ServiceError('JWT INVALID', 'Lenken for å nullstille passordet er ugyldig')
        }

        return {
            accountId: Number(payload.sub),
            issuedAt: new Date(payload.iat * 1000),
            // Tokens issued before the email claim was added carry none.
            email: typeof payload.email === 'string' ? payload.email : null,
        }
    }

    const verifyResetPasswordToken = defineOperation({
        paramsSchema: accountSchemas.params.verifyResetPasswordToken,
        authorizer: () => Require.nothing(),
        operation: async ({ prisma, params }) => {
            const { accountId, issuedAt, email } = readResetPasswordToken(params.token)
            const credentialsUpdatedAt = await kind.readCredentialsUpdatedAt(prisma, accountId)

            // The link is spent by the password it sets: it is older than that password from then on.
            if (credentialsUpdatedAt && credentialsUpdatedAt > issuedAt) {
                throw new ServiceError('JWT INVALID', 'Passordet er allerede endret')
            }

            // The link is for whoever reads the mail at the address it was sent to. Once the account
            // has left that address, its reader must no longer be able to set the password.
            if (email !== null && email !== (await kind.readEmail(prisma, accountId)).email) {
                throw new ServiceError('JWT INVALID', 'Lenken ble sendt til en e-postadresse kontoen ikke lenger har')
            }

            return { accountId, email }
        },
    })

    const resetPassword = defineOperation({
        paramsSchema: accountSchemas.params.resetPassword,
        dataSchema: kind.passwordSchema,
        authorizer: () => Require.nothing(),
        transaction: 'RUNS_IN',
        operation: async ({ prisma, params, data }) => {
            // The link is checked and the password written with the account held, or the account could
            // leave the link's address, or the link be used once more, between the two.
            await kind.lockAccount(prisma, readResetPasswordToken(params.token).accountId)
            const { accountId, email } = await verifyResetPasswordToken({ params, prisma })

            await kind.writePassword(prisma, accountId, data as z.output<PasswordSchema>)

            // Following the link proves the address, which is the account's, so it need not be verified again.
            if (email) await kind.markEmailVerified(prisma, accountId, email)

            return { accountId }
        },
    })

    const sendResetPasswordEmail = defineOperation({
        paramsSchema: accountSchemas.params.sendResetPasswordEmail,
        dataSchema: accountSchemas.data.sendResetPasswordEmail,
        authorizer: () => Require.nothing(),
        operation: ({ params, data }) => {
            // Not awaited: the response must not wait on the lookup or the mail server, or how long
            // it takes would tell whether an account has this email. Failures are logged, never thrown.
            void kind.sendResetPasswordMail(data.email, Site.of(params.site)).catch((err: unknown) => {
                logger.error(`Failed to send reset password to email '${data.email}'`, { error: err })
            })

            return data.email
        },
    })

    const verifyEmail = defineOperation({
        paramsSchema: accountSchemas.params.verifyEmail,
        authorizer: () => Require.nothing(),
        operation: async ({ prisma, params }) => {
            const payload = verifyJWT(params.token, kind.audiences.verifyEmail)

            if (!payload.sub || !payload.email || !payload.iat) {
                throw new ServiceError('JWT INVALID', 'Lenken mangler påkrevd informasjon')
            }

            const accountId = Number(payload.sub)
            const email = String(payload.email)

            // Kept to the millisecond it was issued at (see generateVerifyEmailJWT).
            const iat = new Date(Math.round(payload.iat * 1000))

            const stored = await kind.readEmail(prisma, accountId)

            // Only a later verification spends the token. Other writes to the account must not.
            if (stored.emailVerified && iat < stored.emailVerified) {
                throw new ServiceError('JWT INVALID', kind.messages.verifyEmailLinkSpent)
            }

            let verified
            try {
                verified = await kind.writeVerifiedEmail(prisma, accountId, email)
            } catch (error) {
                // The clicker controls the mailbox, so saying the address is taken leaks nothing.
                if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
                    throw new ServiceError('DUPLICATE', kind.messages.emailTaken)
                }
                throw error
            }
            await kind.notifyEmailChanged(verified, stored.email)

            return verified
        },
    })

    return {
        verifyResetPasswordToken,
        resetPassword,
        sendResetPasswordEmail,
        verifyEmail,
    } as const
}
