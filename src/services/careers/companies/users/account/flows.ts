import '@pn-server-only'
import { companyUserSelection } from '@/services/careers/companies/users/constants'
import { implementAccountFlows } from '@/services/auth/account/implement'
import { userSchemas } from '@/services/users/schemas'
import { ServiceError } from '@/services/error'
import { prisma as globalPrisma } from '@/prisma-pn-client-instance'
import { hashAndEncryptPassword } from '@/auth/passwordHash'
import { sendCompanyUserPasswordMail } from '@/lib/email/systemMail/companyUserPassword'

/**
 * A company user as a kind of account: where the flows of choosing a password by mail and of
 * verifying an email find a company user's password and email, and what they tell them.
 */
export const companyUserAccountFlows = implementAccountFlows({
    audiences: {
        resetPassword: 'companyresetpassword',
        verifyEmail: 'companyverifyemail',
    },
    // A company user's password is held to what a user's is.
    passwordSchema: userSchemas.data.updatePassword,
    readCredentialsUpdatedAt: async (prisma, companyUserId) => {
        const companyUser = await prisma.companyUser.findUnique({
            where: { id: companyUserId },
            select: { active: true, credentials: { select: { credentialsUpdatedAt: true } } },
        })
        // A deactivated company user cannot sign in, so there is no password for them to choose.
        if (!companyUser?.active) throw new ServiceError('NOT FOUND', 'Bedriftsbrukeren finnes ikke eller er deaktivert')
        return companyUser.credentials?.credentialsUpdatedAt ?? null
    },
    writePassword: async (companyUserId, data) => {
        const passwordHash = await hashAndEncryptPassword(data.password)
        await globalPrisma.companyUser.update({
            where: { id: companyUserId },
            data: {
                sessionEpoch: { increment: 1 },
                // A company user gets their first password this way too.
                credentials: { upsert: { create: { passwordHash }, update: { passwordHash } } },
            },
        })
    },
    markEmailVerified: async (prisma, companyUserId, email) => {
        await prisma.companyUser.updateMany({
            where: { id: companyUserId, email, emailVerified: null },
            data: { emailVerified: new Date() },
        })
    },
    readEmail: (prisma, companyUserId) => prisma.companyUser.findUniqueOrThrow({
        where: { id: companyUserId },
        select: { email: true, emailVerified: true },
    }),
    writeVerifiedEmail: (prisma, companyUserId, email) => prisma.companyUser.update({
        where: { id: companyUserId },
        data: { email, emailVerified: new Date() },
        select: companyUserSelection,
    }),
    // Written with the email change itself.
    notifyEmailChanged: async () => {},
    sendResetPasswordMail: async (email) => {
        const companyUser = await globalPrisma.companyUser.findFirst({
            where: { email, active: true },
            select: { id: true, email: true, firstname: true, company: { select: { name: true } } },
        })
        if (companyUser) await sendCompanyUserPasswordMail(companyUser)
    },
    messages: {
        verifyEmailLinkSpent: 'Lenken er allerede brukt eller utdatert. Be om en ny fra siden til brukeren.',
        emailTaken: 'E-postadressen tilhører allerede en annen bedriftsbruker.',
    },
})
