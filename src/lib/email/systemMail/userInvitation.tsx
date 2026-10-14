import '@pn-server-only'
import { userInvitationExpiration } from './constants'
import { generateVerifyEmailJWT } from './verifyEmailToken'
import { sendMailOperations } from '@/services/notifications/send-mail/operations'
import { UserInvitationTemplate } from '@/lib/email/templates/userInvitation'
import { QueryParams } from '@/lib/queryParams/queryParams'
import logger from '@/lib/logger'
import type { UserBasicWithEmail } from '@/services/users/types'

/**
 * Invites a newly created user to verify their email and register. A failure is only logged: the
 * user has already been created.
 */
export async function sendUserInvitationEmail(user: UserBasicWithEmail) {
    const jwt = generateVerifyEmailJWT(user.id, user.email, userInvitationExpiration)

    const link = `${process.env.WEBSITE_URL}/verify-email?${QueryParams.token.encodeUrl(jwt)}`

    try {
        await sendMailOperations.internal.sendSystemMail.internalCall({
            data: {
                to: user.email,
                subject: `Invitasjon til ${process.env.WEBSITE_DOMAIN}`,
                body: <UserInvitationTemplate user={user} link={link} />,
            },
        })
    } catch (error) {
        logger.error(`Failed to send the invitation to user '${user.username}'`, { error })
    }
}
