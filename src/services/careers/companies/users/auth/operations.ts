import '@pn-server-only'
import { companyUserAuthAuth } from './auth'
import { companyUserAccountFlows } from './accountFlows'
import { companyUserAuthSchemas } from './schemas'
import { defineOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import { sendCompanyUserPasswordMail } from '@/lib/email/systemMail/companyUserPassword'
import { sendCompanyUserVerifyEmail } from '@/lib/email/systemMail/companyUserEmail'
import { decryptAndComparePassword } from '@/auth/passwordHash'

/** How a company user gets and keeps the means to sign in: their password and their email. */
export const companyUserAuthOperations = {
    /**
     * Mails the company user a link to choose a password by. It is how they sign in the first time,
     * and how a forgotten password is replaced. Sent on behalf of the company user by someone who
     * may manage them, where `sendResetPasswordEmail` is asked for by whoever types an email.
     */
    sendPasswordLink: defineOperation({
        paramsSchema: companyUserAuthSchemas.params.sendPasswordLink,
        authorizer: async ({ prisma, params }) => {
            const { companyId } = await prisma.companyUser.findUniqueOrThrow({
                where: { id: params.id },
                select: { companyId: true },
            })
            return companyUserAuthAuth.sendPasswordLink.data({ companyId, companyUserId: params.id })
        },
        operation: async ({ prisma, params }) => {
            const companyUser = await prisma.companyUser.findUniqueOrThrow({
                where: { id: params.id },
                select: { id: true, email: true, firstname: true, active: true, company: { select: { name: true } } },
            })
            if (!companyUser.active) {
                throw new ServiceError('BAD PARAMETERS', 'En deaktivert bruker kan ikke logge inn. Aktiver brukeren først.')
            }
            await sendCompanyUserPasswordMail(companyUser)
            return companyUser.email
        },
    }),

    /**
     * Asks to change the email of a company user. The new email is not theirs until they have
     * followed the link sent to it, so nothing changes here.
     */
    registerNewEmail: defineOperation({
        paramsSchema: companyUserAuthSchemas.params.registerNewEmail,
        dataSchema: companyUserAuthSchemas.data.registerNewEmail,
        authorizer: async ({ prisma, params }) => {
            const { companyId } = await prisma.companyUser.findUniqueOrThrow({
                where: { id: params.id },
                select: { companyId: true },
            })
            return companyUserAuthAuth.registerNewEmail.data({ companyId, companyUserId: params.id })
        },
        operation: async ({ prisma, params, data, session }) => {
            const companyUser = await prisma.companyUser.findUniqueOrThrow({
                where: { id: params.id },
                select: {
                    id: true,
                    firstname: true,
                    email: true,
                    emailVerified: true,
                    credentials: { select: { passwordHash: true } },
                },
            })

            if (data.email === companyUser.email && companyUser.emailVerified) {
                return { verified: true, email: data.email }
            }

            // The password link goes to the email, so a company user changing their own must give their
            // password. Those who manage the user are not asked: they can send that link anyway.
            const changesOwn = session.companyUser?.id === companyUser.id
            if (changesOwn && companyUser.credentials && !(
                data.currentPassword
                && await decryptAndComparePassword(data.currentPassword, companyUser.credentials.passwordHash)
            )) {
                throw new ServiceError('BAD PARAMETERS', 'Feil passord.')
            }

            const taken = await prisma.companyUser.findFirst({
                where: { email: data.email, NOT: { id: companyUser.id } },
                select: { id: true },
            })
            if (taken) throw new ServiceError('DUPLICATE', 'E-postadressen tilhører allerede en bedriftsbruker.')

            await sendCompanyUserVerifyEmail(companyUser, data.email)
            return { verified: false, email: data.email }
        },
    }),

    /** Makes the email of a verify email link the company user's. The link is the admission. */
    verifyEmail: companyUserAccountFlows.verifyEmail,

    /** The link by mail, asked for by whoever types the email. The same for a wrong email as a right one. */
    sendResetPasswordEmail: companyUserAccountFlows.sendResetPasswordEmail,
    verifyPasswordToken: companyUserAccountFlows.verifyResetPasswordToken,
    choosePassword: companyUserAccountFlows.resetPassword,
} as const
