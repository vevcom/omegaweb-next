import '@pn-server-only'
import { emailValidationExpiration } from './constants'
import { generateVerifyEmailJWT } from './verifyEmailToken'
import { VerifyEmailTemplate } from '@/lib/email/templates/verifyEmail'
import { sendMailOperations } from '@/services/notifications/sendMail/operations'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { userSchemas } from '@/services/users/schemas'
import { authUrl } from '@/lib/authPaths'
import type { Site } from '@/lib/sites'
import type { UserBasic } from '@/services/users/types'

export async function sendVerifyEmail(user: UserBasic, email: string, site: Site) {
    const parse = userSchemas.data.verifyEmail.parse({ email })

    const jwt = generateVerifyEmailJWT(user.id, parse.email, emailValidationExpiration)

    const link = `${authUrl(site, 'verifyEmail')}?${QueryParams.token.encodeUrl(jwt)}`

    await sendMailOperations.internal.sendSystemMail.internalCall({
        data: {
            to: parse.email,
            subject: 'Bekreft e-post',
            body: <VerifyEmailTemplate user={user} link={link} />,
        },
    })
}
