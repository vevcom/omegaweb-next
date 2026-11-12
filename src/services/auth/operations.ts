import '@pn-server-only'
import { authAuth } from './auth'
import { authSchemas, linkFeideAccountClaimsSchema } from './schemas'
import { moveFeideAccountToUser } from './feideAccounts/move'
import { userAccountFlows } from './userAccount'
import { Site } from '@/lib/sites/site'
import { userBasicSelection, userPartitions } from '@/services/users/constants'
import { sendLinkFeideAccountMail } from '@/lib/email/systemMail/linkFeideAccount'
import { defineOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import { verifyJWT } from '@/lib/jwt/jwt'
import { feideEmailDomainsTrustedAsVerified } from '@/lib/feide/constants'
import logger from '@/lib/logger'

/** Verifies and reads the claims of a link Feide account token. */
function readLinkFeideAccountClaims(token: string) {
    const claims = linkFeideAccountClaimsSchema.safeParse(verifyJWT(token, 'linkfeideaccount'))

    if (!claims.success) {
        throw new ServiceError('JWT INVALID', 'Lenken mangler påkrevd informasjon')
    }

    return claims.data
}

export const authOperations = {
    // Choosing a password by mail and verifying an email are the same for every kind of account,
    // and are implemented for a user in userAccount.ts.
    verifyEmail: userAccountFlows.verifyEmail,
    verifyResetPasswordToken: userAccountFlows.verifyResetPasswordToken,
    resetPassword: userAccountFlows.resetPassword,
    sendResetPasswordEmail: userAccountFlows.sendResetPasswordEmail,

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
                    }, Site.of(params.site))
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
        transaction: 'RUNS_IN',
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
        transaction: 'RUNS_IN',
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
} as const
