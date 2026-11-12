import '@pn-server-only'
import { emailValidationExpiration } from './constants'
import {
    CompanyUserEmailChangedTemplate,
    CompanyUserVerifyEmailTemplate,
} from '@/lib/email/templates/companyUserEmail'
import { sendMailOperations } from '@/services/mail/send/operations'
import { generateVerifyEmailJWT } from '@/services/accountFlows/tokens'
import { DomainContext } from '@/lib/sites/context'
import { Site } from '@/lib/sites/site'
import logger from '@/lib/logger'
import { careerLinks } from '@/app/(careers)/links'

/** Sends the link a company user confirms a new email by, to that email. */
export async function sendCompanyUserVerifyEmail(companyUser: { id: number, firstname: string }, email: string) {
    const jwt = generateVerifyEmailJWT('companyverifyemail', companyUser.id, email, emailValidationExpiration)
    const link = DomainContext.siteUrl(Site.CAREERS, careerLinks.companyVerifyEmail(jwt))

    await sendMailOperations.sendSystemMail.internalCall({
        data: {
            to: email,
            subject: 'Bekreft e-post hos Contactor',
            body: <CompanyUserVerifyEmailTemplate firstname={companyUser.firstname} link={link} />,
        },
    })
}

/**
 * Tells the old address that the email of a company user was changed. A failure is only logged:
 * the change itself has already happened.
 */
export async function sendCompanyUserEmailChangedMail(
    companyUser: { id: number, firstname: string, email: string },
    oldEmail: string,
) {
    if (oldEmail === companyUser.email) return

    try {
        await sendMailOperations.sendSystemMail.internalCall({
            data: {
                to: oldEmail,
                subject: 'E-posten din hos Contactor er endret',
                body: <CompanyUserEmailChangedTemplate firstname={companyUser.firstname} newEmail={companyUser.email} />,
            },
        })
    } catch (error) {
        logger.error(`Failed to tell the old email of company user ${companyUser.id} about the change`, { error })
    }
}
