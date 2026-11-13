import '@pn-server-only'
import { implementAccountFlows } from '@/services/accountFlows/implement'
import { userBasicSelection, userPartitions } from '@/services/users/constants'
import { userOperations } from '@/services/users/operations'
import { userSchemas } from '@/services/users/schemas'
import { sendResetPasswordMail } from '@/lib/email/systemMail/resetPassword'
import { sendEmailChangedMail } from '@/lib/email/systemMail/emailChanged'

/**
 * A user as a kind of account: where the flows of choosing a password by mail and of verifying an
 * email find a user's password and email, and what they tell the user.
 */
export const userAccountFlows = implementAccountFlows({
    audiences: {
        resetPassword: 'resetpassword',
        verifyEmail: 'verifyemail',
    },
    passwordSchema: userSchemas.data.updatePassword,
    readCredentialsUpdatedAt: async (prisma, userId) => {
        const user = await prisma.user.findUniqueOrThrow({
            where: {
                id: userId,
                ...userPartitions.unarchived,
            },
            select: {
                credentials: { select: { credentialsUpdatedAt: true } },
            },
        })
        return user.credentials?.credentialsUpdatedAt ?? null
    },
    lockAccount: (prisma, userId) => prisma.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`,
    writePassword: async (prisma, userId, data) => {
        await userOperations.updatePassword({
            params: { id: userId },
            data,
            bypassAuth: true,
            prisma,
        })
    },
    markEmailVerified: async (prisma, userId, email) => {
        await prisma.user.updateMany({
            where: { id: userId, email, emailVerified: null },
            data: { emailVerified: new Date() },
        })
    },
    readEmail: (prisma, userId) => userOperations.read({ params: { id: userId }, bypassAuth: true, prisma }),
    writeVerifiedEmail: (prisma, userId, email) => prisma.user.update({
        where: { id: userId },
        data: {
            emailVerified: new Date(),
            email,
        },
        select: {
            ...userBasicSelection,
            email: true,
            acceptedTerms: true,
        },
    }),
    notifyEmailChanged: sendEmailChangedMail,
    sendResetPasswordMail,
    messages: {
        verifyEmailLinkSpent: 'Lenken er allerede brukt eller utdatert. Be om en ny e-post fra registreringssiden.',
        emailTaken: 'E-postadressen tilhører allerede en annen bruker. Hadde du bruker på gamle ' +
            'Omegaveven med denne adressen, velg «Koble til eksisterende bruker» på registreringssiden.',
    },
})
