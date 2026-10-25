import '@pn-server-only'
import { resetPasswordExpiration } from './constants'
import { sendMailOperations } from '@/services/notifications/sendMail/operations'
import { ResetPasswordTemplate } from '@/lib/email/templates/resetPassword'
import { generateJWT } from '@/jwt/jwt'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { userOperations } from '@/services/users/operations'
import { z } from 'zod'

// TODO: This function should not be in lib! It is highly coupled to the project.

export async function sendResetPasswordMail(email: string) {
    const emailParsed = z.string().email().parse(email)

    const user = await userOperations.readOrNull({ params: { email: emailParsed }, bypassAuth: true })
    if (!user) return email

    // The email lets the reset also verify the address, since only its owner can follow the link.
    const jwt = generateJWT('resetpassword', {
        sub: user.id,
        email: user.email,
    }, resetPasswordExpiration)

    const link = `${process.env.WEBSITE_URL}/reset-password-form?${QueryParams.token.encodeUrl(jwt)}`

    await sendMailOperations.internal.sendSystemMail.internalCall({
        data: {
            to: user.email,
            subject: 'Glemt passord',
            body: <ResetPasswordTemplate user={user} link={link} />,
        },
    })

    return email
}
