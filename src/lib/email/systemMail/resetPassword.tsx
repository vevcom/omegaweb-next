import '@pn-server-only'
import { resetPasswordExpiration } from './constants'
import { sendMailOperations } from '@/services/notifications/sendMail/operations'
import { ResetPasswordTemplate } from '@/lib/email/templates/resetPassword'
import { generateJWT } from '@/jwt/jwt'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { userBasicSelection } from '@/services/users/constants'
import { prisma } from '@/prisma-pn-client-instance'
import { z } from 'zod'

// TODO: This function should not be in lib! It is highly coupled to the project.

export async function sendResetPasswordMail(email: string) {
    const emailParsed = z.string().email().parse(email)

    // TODO: User operations should maybe be used here instead.
    // Currently, it doesn't support filtering by archived, but that should be added.
    const user = await prisma.user.findUnique({
        where: { email: emailParsed, archived: false },
        select: { ...userBasicSelection, email: true },
    })
    if (!user) return email

    const jwt = generateJWT('resetpassword', {
        sub: user.id,
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
