import '@pn-server-only'
import { authAuth } from './auth'
import { authSchemas } from './schemas'
import { moveFeideAccountToUser } from './feideAccounts/move'
import { userBasicSelection } from '@/services/users/constants'
import { userSchemas } from '@/services/users/schemas'
import { sendResetPasswordMail } from '@/lib/email/systemMail/resetPassword'
import { sendLinkFeideAccountMail } from '@/lib/email/systemMail/linkFeideAccount'
import { sendEmailChangedMail } from '@/lib/email/systemMail/emailChanged'
import { defineOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import { userOperations } from '@/services/users/operations'
import { verifyJWT } from '@/lib/jwt/jwt'
import logger from '@/lib/logger'
import { z } from 'zod'

const linkFeideAccountClaimsSchema = z.object({
    sub: z.coerce.number(),
    feideUserId: z.coerce.number(),
    feideAccountId: z.string(),
    feideName: z.string(),
    feideEmail: z.string(),
}).transform(({ sub, ...claims }) => ({ targetUserId: sub, ...claims }))

/** Verifies and reads the claims of a link Feide account token. */
function readLinkFeideAccountClaims(token: string) {
    const claims = linkFeideAccountClaimsSchema.safeParse(verifyJWT(token, 'linkfeideaccount'))

    if (!claims.success) {
        throw new ServiceError('JWT INVALID', 'The JWT does not contain the mandatory fields')
    }

    return claims.data
}

export const authOperations = {
    verifyEmail: defineOperation({
        paramsSchema: z.object({
            token: z.string(),
        }),
        authorizer: () => authAuth.verifyEmail,
        operation: async ({ prisma, params }) => {
            const payload = verifyJWT(params.token, 'verifyemail')

            if (!payload.sub || !payload.email || !payload.iat) {
                throw new ServiceError('JWT INVALID', 'The JWT does not contain the mandatory fields')
            }

            const userId = Number(payload.sub)
            const email = String(payload.email)

            const iat = new Date(payload.iat * 1000)

            const user = await userOperations.read({
                params: {
                    id: userId,
                },
                bypassAuth: true,
            })

            if (iat < user.updatedAt) {
                throw new ServiceError('JWT INVALID', 'The user has changed since the token was generated.')
            }

            const updatedUser = await prisma.user.update({
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
            await sendEmailChangedMail(updatedUser, user.email)

            return updatedUser
        }
    }),

    verifyResetPasswordToken: defineOperation({
        paramsSchema: z.object({
            token: z.string()
        }),
        authorizer: () => authAuth.resetPassword,
        operation: async ({ prisma, params }) => {
            const payload = verifyJWT(params.token, 'resetpassword')

            if (!payload.sub || !payload.iat) {
                throw new ServiceError('JWT INVALID', 'The forgot password JWT is not valid')
            }

            const userId = Number(payload.sub)

            const user = await prisma.user.findUniqueOrThrow({
                where: {
                    id: userId,
                },
                select: {
                    credentials: true
                }
            })

            if (user.credentials && user.credentials?.credentialsUpdatedAt > new Date(payload.iat * 1000)) {
                throw new ServiceError('JWT INVALID', 'The password has already been changed')
            }

            return userId
        }
    }),

    resetPassword: defineOperation({
        paramsSchema: z.object({
            token: z.string()
        }),
        dataSchema: userSchemas.updatePassword,
        authorizer: () => authAuth.resetPassword,
        operation: async ({ params, data }) => {
            const userId = await authOperations.verifyResetPasswordToken({ params })

            await userOperations.updatePassword({
                params: {
                    id: userId,
                },
                data,
                bypassAuth: true,
            })
        }
    }),

    sendLinkFeideAccountEmail: defineOperation({
        dataSchema: authSchemas.sendLinkFeideAccountEmail,
        authorizer: () => authAuth.sendLinkFeideAccountEmail,
        operation: async ({ prisma, data, session }) => {
            if (!session.user) {
                throw new ServiceError('DISSALLOWED', 'This endpoint requires a user connected to the session.')
            }

            // Only a user created by a Feide login that has not completed registration may ask
            // to be moved onto a migrated user - any other user asking, such as a migrated user
            // the Feide login was linked to by email, would end with that user being deleted.
            const feideUser = await prisma.user.findUniqueOrThrow({
                where: { id: session.user.id },
                select: {
                    id: true,
                    firstname: true,
                    lastname: true,
                    acceptedTerms: true,
                    createdByFeideLoginOnProjectNext: true,
                    credentials: { select: { userId: true } },
                    feideAccount: { select: { id: true, email: true } },
                },
            })

            if (
                !feideUser.feideAccount ||
                !feideUser.createdByFeideLoginOnProjectNext ||
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
     * Reads how the Feide login of the session user was matched to a user, so registration can
     * tell the user whether it was linked to their existing user or a new user was created.
     * Returns null if the session user has no Feide account.
     */
    readFeideLoginMatch: defineOperation({
        authorizer: () => authAuth.readFeideLoginMatch,
        operation: async ({ prisma, session }) => {
            if (!session.user) {
                throw new ServiceError('DISSALLOWED', 'This endpoint requires a user connected to the session.')
            }

            const user = await prisma.user.findUniqueOrThrow({
                where: { id: session.user.id },
                select: {
                    createdByFeideLoginOnProjectNext: true,
                    feideAccount: { select: { email: true } },
                },
            })

            if (!user.feideAccount) return null

            return {
                feideEmail: user.feideAccount.email,
                createdByFeideLoginOnProjectNext: user.createdByFeideLoginOnProjectNext,
            }
        }
    }),

    verifyLinkFeideAccountToken: defineOperation({
        paramsSchema: z.object({
            token: z.string(),
        }),
        authorizer: () => authAuth.verifyLinkFeideAccountToken,
        operation: async ({ prisma, params }) => {
            const claims = readLinkFeideAccountClaims(params.token)

            const targetUser = await prisma.user.findUniqueOrThrow({
                where: { id: claims.targetUserId },
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
        paramsSchema: z.object({
            token: z.string(),
        }),
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
        dataSchema: authSchemas.adminLinkFeideAccount,
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

            await moveFeideAccountToUser(prisma, {
                fromUserId: fromUser.id,
                toUserId: toUser.id,
            })
        }
    }),

    sendResetPasswordEmail: defineOperation({
        dataSchema: authSchemas.sendResetPasswordEmail,
        authorizer: () => authAuth.sendResetPasswordEmail,
        operation: async ({ data }) => {
            try {
                const user = await userOperations.read({
                    params: {
                        email: data.email,
                    },
                    bypassAuth: true,
                })

                sendResetPasswordMail(user.email)
            } catch (err) {
                logger.error(`Failed to send reset password to email '${data.email}'`, { error: err })
                return data.email
            }

            return data.email
        }
    }),
} as const
