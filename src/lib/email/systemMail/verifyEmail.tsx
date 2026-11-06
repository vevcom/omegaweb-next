import '@pn-server-only'
import { emailValidationExpiration } from './constants'
import { generateVerifyEmailJWT } from './verifyEmailToken'
import { VerifyEmailTemplate } from '@/lib/email/templates/verifyEmail'
import { sendMailOperations } from '@/services/notifications/sendMail/operations'
import { userSchemas } from '@/services/users/schemas'
import { DomainContext } from '@/lib/sites/context'
import { authLinks } from '@/pageKits/auth/links'
import { authPagesOf } from '@/lib/sites/authPagesOf'
import type { Site } from '@/lib/sites/site'
import type { UserBasic } from '@/services/users/types'

export async function sendVerifyEmail(user: UserBasic, email: string, site: Site) {
    const parse = userSchemas.data.verifyEmail.parse({ email })

    const jwt = generateVerifyEmailJWT(user.id, parse.email, emailValidationExpiration)

    const link = DomainContext.publicUrl(site, authLinks(authPagesOf(site)).verifyEmail(jwt))

    await sendMailOperations.internal.sendSystemMail.internalCall({
        data: {
            to: parse.email,
            subject: 'Bekreft e-post',
            body: <VerifyEmailTemplate user={user} link={link} />,
        },
    })
}
