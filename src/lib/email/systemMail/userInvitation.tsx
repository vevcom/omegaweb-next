import '@pn-server-only'
import { userInvitationExpiration } from './constants'
import { generateVerifyEmailJWT } from './verifyEmailToken'
import { sendMailOperations } from '@/services/notifications/sendMail/operations'
import { UserInvitationTemplate } from '@/lib/email/templates/userInvitation'
import logger from '@/lib/logger'
import { DomainContext } from '@/lib/sites/context'
import { Site } from '@/lib/sites/site'
import { authLinks } from '@/pageKits/auth/links'
import { authPagesOf } from '@/pageKits/auth/authPagesOf'
import type { UserBasicWithEmail } from '@/services/users/types'

/**
 * Invites a newly created user to verify their email and register. Never throws, so it can run
 * without being awaited: a failure is only logged, since the user has already been created.
 */
export async function sendUserInvitationEmail(user: UserBasicWithEmail) {
    try {
        const jwt = generateVerifyEmailJWT(user.id, user.email, userInvitationExpiration)

        const link = DomainContext.authDomainUrl(authLinks(authPagesOf(Site.OMEGAWEB)).verifyEmail(jwt))

        await sendMailOperations.internal.sendSystemMail.internalCall({
            data: {
                to: user.email,
                subject: `Invitasjon til ${DomainContext.mailDomainOf(Site.root)}`,
                body: <UserInvitationTemplate user={user} link={link} />,
            },
        })
    } catch (error) {
        logger.error(`Failed to send the invitation to user '${user.username}'`, { error })
    }
}
