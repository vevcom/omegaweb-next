import '@pn-server-only'
import { companyUserAccountAuth } from './auth'
import { companyUserAccountFlows } from './flows'
import { companyUserAccountSchemas } from './schemas'
import { defineOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import { sendCompanyUserPasswordMail } from '@/lib/email/systemMail/companyUserPassword'

/** How a company user gets and keeps the means to sign in: their password and their email. */
export const companyUserAccountOperations = {
    /**
     * Mails the company user a link to choose a password by. It is how they sign in the first time,
     * and how a forgotten password is replaced. Sent on behalf of the company user by someone who
     * may manage them, where `sendResetPasswordEmail` is asked for by whoever types an email.
     */
    sendPasswordLink: defineOperation({
        paramsSchema: companyUserAccountSchemas.params.sendPasswordLink,
        authorizer: async ({ prisma, params }) => {
            const { companyId } = await prisma.companyUser.findUniqueOrThrow({
                where: { id: params.id },
                select: { companyId: true },
            })
            return companyUserAccountAuth.sendPasswordLink.data({ companyId, companyUserId: params.id })
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

    /** The link by mail, asked for by whoever types the email. The same for a wrong email as a right one. */
    sendResetPasswordEmail: companyUserAccountFlows.sendResetPasswordEmail,
    verifyPasswordToken: companyUserAccountFlows.verifyResetPasswordToken,
    choosePassword: companyUserAccountFlows.resetPassword,
} as const
