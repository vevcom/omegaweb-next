import '@pn-server-only'
import { userInvitationExpiration } from './constants'
import { generateVerifyEmailJWT } from './verifyEmailToken'
import { sendMailOperations } from '@/services/notifications/sendMail/operations'
import { UserInvitationTemplate } from '@/lib/email/templates/userInvitation'
import { QueryParams } from '@/lib/queryParams/queryParams'
import logger from '@/lib/logger'
import type { UserBasicWithEmail } from '@/services/users/types'

/**
 * Invites a newly created user to verify their email and register. Never throws, so it can run
 * without being awaited: a failure is only logged, since the user has already been created.
 */
export async function sendUserInvitationEmail(user: UserBasicWithEmail) {
    try {
        const jwt = generateVerifyEmailJWT(user.id, user.email, userInvitationExpiration)

        const link = `${process.env.WEBSITE_URL}/verify-email?${QueryParams.token.encodeUrl(jwt)}`

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
