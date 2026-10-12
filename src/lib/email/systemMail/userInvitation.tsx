import '@pn-server-only'
import { userInvitationExpiration } from './constants'
import { sendMailOperations } from '@/services/notifications/send-mail/operations'
import { UserInvitationTemplate } from '@/lib/email/templates/userInvitation'
import { generateJWT } from '@/jwt/jwt'
import { QueryParams } from '@/lib/queryParams/queryParams'
import type { UserBasicWithEmail } from '@/services/users/types'

export async function sendUserInvitationEmail(user: UserBasicWithEmail) {
    const jwt = generateJWT('verifyemail', {
        sub: user.id,
        email: user.email,
    }, userInvitationExpiration)

    const link = `${process.env.WEBSITE_URL}/verify-email?${QueryParams.token.encodeUrl(jwt)}`

    await sendMailOperations.internal.sendSystemMail.internalCall({
        data: {
            to: user.email,
            subject: `Invitasjon til ${process.env.WEBSITE_DOMAIN}`,
            body: <UserInvitationTemplate user={user} link={link} />,
        },
    })
}
