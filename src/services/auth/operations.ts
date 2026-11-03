import '@pn-server-only'
import { authAuth } from './auth'
import { authSchemas, linkFeideAccountClaimsSchema } from './schemas'
import { moveFeideAccountToUser } from './feideAccounts/move'
import { userBasicSelection, userPartitions } from '@/services/users/constants'
import { sendResetPasswordMail } from '@/lib/email/systemMail/resetPassword'
import { sendLinkFeideAccountMail } from '@/lib/email/systemMail/linkFeideAccount'
import { sendEmailChangedMail } from '@/lib/email/systemMail/emailChanged'
import { defineOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import { userOperations } from '@/services/users/operations'
import { verifyJWT } from '@/lib/jwt/jwt'
import { feideEmailDomainsTrustedAsVerified } from '@/lib/feide/constants'
import logger from '@/lib/logger'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client'

/** Verifies and reads the claims of a link Feide account token. */
function readLinkFeideAccountClaims(token: string) {
    const claims = linkFeideAccountClaimsSchema.safeParse(verifyJWT(token, 'linkfeideaccount'))

    if (!claims.success) {
        throw new ServiceError('JWT INVALID', 'Lenken mangler påkrevd informasjon')
    }

    return claims.data
}

export const authOperations = {
    verifyEmail: defineOperation({
        paramsSchema: authSchemas.params.verifyEmail,
        authorizer: () => authAuth.verifyEmail,
        operation: async ({ prisma, params }) => {
            const payload = verifyJWT(params.token, 'verifyemail')

            if (!payload.sub || !payload.email || !payload.iat) {
                throw new ServiceError('JWT INVALID', 'Lenken mangler påkrevd informasjon')
            }

            const userId = Number(payload.sub)
            const email = String(payload.email)

            // Kept to the millisecond it was issued at (see generateVerifyEmailJWT).
            const iat = new Date(Math.round(payload.iat * 1000))

            const user = await userOperations.read({
                params: {
                    id: userId,
                },
                bypassAuth: true,
            })

            // Only a later verification spends the token. Other writes to the user, such as the one
            // every Feide login makes, must not.
            if (user.emailVerified && iat < user.emailVerified) {
                throw new ServiceError(
                    'JWT INVALID',
                    'Lenken er allerede brukt eller utdatert. Be om en ny e-post fra registreringssiden.'
                )
            }

            let updatedUser
            try {
                updatedUser = await prisma.user.update({
                    where: {
                        id: userId,
                    },
                    data: {
                        emailVerified: new Date(),
                        email,
                    },
                    select: {
                        ...userBasicSelection,
                        email: true,
                        acceptedTerms: true,
                    },
                })
            } catch (error) {
                // The clicker controls the mailbox, so saying the address is taken leaks nothing.
                if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
                    throw new ServiceError(
                        'DUPLICATE',
                        'E-postadressen tilhører allerede en annen bruker. Hadde du bruker på gamle ' +
                        'Omegaveven med denne adressen, velg «Koble til eksisterende bruker» på registreringssiden.'
                    )
                }
                throw error
            }
            await sendEmailChangedMail(updatedUser, user.email)

            return updatedUser
        }
    }),

    verifyResetPasswordToken: defineOperation({
        paramsSchema: authSchemas.params.verifyResetPasswordToken,
        authorizer: () => authAuth.verifyResetPasswordToken,
        operation: async ({ prisma, params }) => {
            const payload = verifyJWT(params.token, 'resetpassword')

            if (!payload.sub || !payload.iat) {
                throw new ServiceError('JWT INVALID', 'Lenken for å nullstille passordet er ugyldig')
            }

            const userId = Number(payload.sub)

            const user = await prisma.user.findUniqueOrThrow({
                where: {
                    id: userId,
                    ...userPartitions.unarchived,
                },
                select: {
                    credentials: true,
                }
            })

            if (user.credentials && user.credentials?.credentialsUpdatedAt > new Date(payload.iat * 1000)) {
                throw new ServiceError('JWT INVALID', 'Passordet er allerede endret')
            }

            // Tokens issued before the email claim was added carry none.
            return { userId, email: typeof payload.email === 'string' ? payload.email : null }
        }
    }),

    resetPassword: defineOperation({
        paramsSchema: authSchemas.params.resetPassword,
        dataSchema: authSchemas.data.resetPassword,
        authorizer: () => authAuth.resetPassword,
        operation: async ({ prisma, params, data }) => {
            const { userId, email } = await authOperations.verifyResetPasswordToken({ params })

            await userOperations.updatePassword({
                params: {
                    id: userId,
                },
                data,
                bypassAuth: true,
            })

            // Following the link proves the address, so a user signing up need not verify it again.
            if (email) {
                await prisma.user.updateMany({
                    where: { id: userId, email, emailVerified: null },
                    data: { emailVerified: new Date() },
                })
            }
        }
    }),

    sendLinkFeideAccountEmail: defineOperation({
        paramsSchema: authSchemas.params.sendLinkFeideAccountEmail,
        dataSchema: authSchemas.data.sendLinkFeideAccountEmail,
        authorizer: ({ params }) => authAuth.sendLinkFeideAccountEmail.data({ userId: params.userId }),
        operation: async ({ prisma, data, params }) => {
            // Only a user created by a Feide login that has not completed registration may ask
            // to be moved onto a migrated user - any other user asking, such as a migrated user
            // the Feide login was linked to by email, would end with that user being deleted.
            const feideUser = await prisma.user.findUniqueOrThrow({
                where: { id: params.userId },
                select: {
                    id: true,
                    firstname: true,
                    lastname: true,
                    acceptedTerms: true,
                    createdByFeideLoginOnOmegawebNext: true,
                    credentials: { select: { userId: true } },
                    feideAccount: { select: { id: true, email: true } },
                },
            })

            if (
                !feideUser.feideAccount ||
                !feideUser.createdByFeideLoginOnOmegawebNext ||
                feideUser.credentials ||
                feideUser.acceptedTerms
            ) {
                throw new ServiceError(
                    'DISSALLOWED',
                    'Bare en ny Feide-innlogging som ikke har fullført registreringen kan kobles til en gammel bruker.'
                )
            }

            const usernameOrEmail = data.usernameOrEmail.trim().toLowerCase()

            // The response is the same whether the user was found or not, so this endpoint
            // cannot be used to probe which users exist or are still unclaimed.
            const targetUser = await prisma.user.findFirst({
                where: {
                    OR: [{ username: usernameOrEmail }, { email: usernameOrEmail }],
                    feideAccount: null,
                    credentials: null,
                    ...userPartitions.unarchived,
                    NOT: { id: feideUser.id },
                },
                select: {
                    ...userBasicSelection,
                    email: true,
                },
            })

            if (targetUser) {
                try {
                    await sendLinkFeideAccountMail(targetUser, {
                        userId: feideUser.id,
                        feideAccountId: feideUser.feideAccount.id,
                        name: `${feideUser.firstname} ${feideUser.lastname}`,
                        email: feideUser.feideAccount.email,
                    })
                } catch (err) {
                    logger.error(`Failed to send link feide account mail to user '${targetUser.username}'`, { error: err })
                }
            }

            return data.usernameOrEmail
        }
    }),

    /**
     * Reads how the Feide login of a user was matched to a user, so registration can tell them
     * whether it was linked to their existing user or a new user was created. Returns null if
     * the user has no Feide account.
     */
    readFeideLoginMatch: defineOperation({
        paramsSchema: authSchemas.params.readFeideLoginMatch,
        authorizer: ({ params }) => authAuth.readFeideLoginMatch.data({ userId: params.userId }),
        operation: async ({ prisma, params }) => {
            const user = await prisma.user.findUniqueOrThrow({
                where: { id: params.userId },
                select: {
                    createdByFeideLoginOnOmegawebNext: true,
                    feideAccount: { select: { email: true } },
                },
            })

            if (!user.feideAccount) return null

            const feideEmailDomain = user.feideAccount.email.split('@').pop() ?? ''

            return {
                feideEmail: user.feideAccount.email,
                feideEmailTrustedAsVerified: feideEmailDomainsTrustedAsVerified.includes(feideEmailDomain),
                createdByFeideLoginOnOmegawebNext: user.createdByFeideLoginOnOmegawebNext,
            }
        }
    }),

    verifyLinkFeideAccountToken: defineOperation({
        paramsSchema: authSchemas.params.verifyLinkFeideAccountToken,
        authorizer: () => authAuth.verifyLinkFeideAccountToken,
        operation: async ({ prisma, params }) => {
            const claims = readLinkFeideAccountClaims(params.token)

            const targetUser = await prisma.user.findUniqueOrThrow({
                where: { id: claims.targetUserId, ...userPartitions.unarchived },
                select: { username: true },
            })

            // What is shown comes from the signed claims, so it is exactly the identity the
            // confirmation moves - not whatever the users look like now.
            return {
                targetUsername: targetUser.username,
                feideName: claims.feideName,
                feideEmail: claims.feideEmail,
            }
        }
    }),

    linkFeideAccount: defineOperation({
        paramsSchema: authSchemas.params.linkFeideAccount,
        authorizer: () => authAuth.linkFeideAccount,
        opensTransaction: true,
        operation: async ({ prisma, params }) => {
            const claims = readLinkFeideAccountClaims(params.token)

            await moveFeideAccountToUser(prisma, {
                fromUserId: claims.feideUserId,
                toUserId: claims.targetUserId,
                feideAccountId: claims.feideAccountId,
            })
        }
    }),

    adminLinkFeideAccount: defineOperation({
        dataSchema: authSchemas.data.adminLinkFeideAccount,
        authorizer: () => authAuth.adminLinkFeideAccount,
        opensTransaction: true,
        operation: async ({ prisma, data }) => {
            const fromUser = await prisma.user.findUniqueOrThrow({
                where: { username: data.fromUsername.trim().toLowerCase() },
                select: { id: true },
            })
            const toUser = await prisma.user.findUniqueOrThrow({
                where: { username: data.toUsername.trim().toLowerCase() },
                select: { id: true },
            })

            // An administrator merges duplicates however far the duplicate got, so it may have
            // finished registering. Its credentials and terms go with it.
            await moveFeideAccountToUser(prisma, {
                fromUserId: fromUser.id,
                toUserId: toUser.id,
                allowFinishedRegistration: true,
            })
        }
    }),

    sendResetPasswordEmail: defineOperation({
        dataSchema: authSchemas.data.sendResetPasswordEmail,
        authorizer: () => authAuth.sendResetPasswordEmail,
        operation: ({ data }) => {
            // Not awaited: the response must not wait on the lookup or the mail server, or how long
            // it takes would tell whether a user has this email. Failures are logged, never thrown.
            void sendResetPasswordMail(data.email).catch((err: unknown) => {
                logger.error(`Failed to send reset password to email '${data.email}'`, { error: err })
            })

            return data.email
        }
    }),
} as const
