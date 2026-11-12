import '@pn-server-only'
import { companyUserPasswordExpiration } from './constants'
import { CompanyUserPasswordTemplate } from '@/lib/email/templates/companyUserPassword'
import { sendMailOperations } from '@/services/mail/send/operations'
import { generateResetPasswordJWT } from '@/services/accountFlows/tokens'
import { DomainContext } from '@/lib/sites/context'
import { Site } from '@/lib/sites/site'
import { careerLinks } from '@/app/(careers)/links'

/**
 * Sends a company user the link they choose a password by. The link goes to the career site,
 * which is the only place a company user signs in.
 */
export async function sendCompanyUserPasswordMail(companyUser: {
    id: number,
    email: string,
    firstname: string,
    company: { name: string },
}) {
    const jwt = generateResetPasswordJWT(
        'companyresetpassword', companyUser.id, companyUser.email, companyUserPasswordExpiration
    )
    const link = DomainContext.siteUrl(Site.CAREERS, careerLinks.companyPassword(jwt))

    await sendMailOperations.sendSystemMail.internalCall({
        data: {
            to: companyUser.email,
            subject: 'Velg passord hos Contactor',
            body: (
                <CompanyUserPasswordTemplate
                    firstname={companyUser.firstname}
                    companyName={companyUser.company.name}
                    email={companyUser.email}
                    link={link}
                />
            ),
        },
    })
}
