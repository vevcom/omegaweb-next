import '@pn-server-only'
import { resetPasswordExpiration } from './constants'
import { sendMailOperations } from '@/services/notifications/sendMail/operations'
import { ResetPasswordTemplate } from '@/lib/email/templates/resetPassword'
import { generateJWT } from '@/jwt/jwt'
import { userOperations } from '@/services/users/operations'
import { publicUrl } from '@/lib/sites/domains'
import { authLinks } from '@/pageKits/auth/links'
import { authPagesOfSite } from '@/lib/sites/authPagesOfSite'
import { z } from 'zod'
import type { Site } from '@/lib/sites/sites'

// TODO: This function should not be in lib! It is highly coupled to the project.

export async function sendResetPasswordMail(email: string, site: Site) {
    const emailParsed = z.string().email().parse(email)

    const user = await userOperations.readOrNull({ params: { email: emailParsed }, bypassAuth: true })
    if (!user) return email

    // The email lets the reset also verify the address, since only its owner can follow the link.
    const jwt = generateJWT('resetpassword', {
        sub: user.id,
        email: user.email,
    }, resetPasswordExpiration)

    const link = publicUrl(site, authLinks(authPagesOfSite[site]).resetPasswordForm(jwt))

    await sendMailOperations.internal.sendSystemMail.internalCall({
        data: {
            to: user.email,
            subject: 'Glemt passord',
            body: <ResetPasswordTemplate user={user} link={link} />,
        },
    })

    return email
}
