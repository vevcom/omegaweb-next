import '@pn-server-only'
import { sendMailOperations } from '@/services/mail/send/operations'
import { LinkFeideAccountTemplate } from '@/lib/email/templates/linkFeideAccount'
import { generateJWT } from '@/jwt/jwt'
import { DomainContext } from '@/lib/sites/context'
import { authLinks } from '@/pageKits/auth/links'
import { authPagesOf } from '@/pageKits/auth/authPagesOf'
import type { Site } from '@/lib/sites/site'
import type { FeideIdentity } from '@/services/auth/types'
import type { UserBasicWithEmail } from '@/services/users/types'

/**
 * Sends a mail to a migrated, unclaimed user with a link that confirms moving a
 * fresh Feide login onto them. The link carries a JWT naming the target user, the
 * user holding the Feide account and the Feide identity itself, so what the
 * recipient is shown and what the link moves can not differ.
 *
 * @param targetUser - The migrated user the Feide login should be moved to.
 * @param feideIdentity - The Feide identity to move, and the fresh user currently holding it.
 * @param site - The site the link opens on.
 */
export async function sendLinkFeideAccountMail(
    targetUser: UserBasicWithEmail,
    feideIdentity: FeideIdentity,
    site: Site,
) {
    const jwt = generateJWT('linkfeideaccount', {
        sub: targetUser.id,
        feideUserId: feideIdentity.userId,
        feideAccountId: feideIdentity.feideAccountId,
        feideName: feideIdentity.name,
        feideEmail: feideIdentity.email,
    }, 60 * 60)

    const link = DomainContext.authDomainUrl(authLinks(authPagesOf(site)).linkOwUser(jwt))

    await sendMailOperations.sendSystemMail.internalCall({
        data: {
            to: targetUser.email,
            subject: 'Koble Feide-innlogging til gammel bruker',
            body: <LinkFeideAccountTemplate user={targetUser} feideIdentity={feideIdentity} link={link} />,
        },
    })
}
