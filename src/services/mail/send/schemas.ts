import { isOwnMailAddress, validMailAddressDomains } from '@/services/mail/constants'
import { z } from 'zod'
import type Mail from 'nodemailer/lib/mailer'
import type React from 'react'

const dataFieldSchemas = z.object({
    from: z.string().email('Ikke en gyldig e-post').refine(
        isOwnMailAddress,
        () => ({ message: `Avsenderen må være en adresse på ${validMailAddressDomains().join(' eller ')}` })
    ),
    to: z.string().email('Ikke en gyldig e-post'),
    subject: z.string().min(2, 'Minimum 2 tegn').max(100, 'Maksimum 100 tegn'),
    text: z.string().min(2, 'Minimum 2 tegn'),
    body: z.custom<React.JSX.Element | string>(),
})

export const sendMailSchemas = {
    data: {
        // Not an operation's: what the notification dispatchers check each mail against before sending
        // it through sendBulkMail.
        notificationMail: dataFieldSchemas.pick({
            from: true,
            to: true,
            subject: true,
            text: true,
        }),
        sendBulkMail: z.custom<Mail.Options>().array(),
        sendSystemMail: dataFieldSchemas.pick({
            to: true,
            subject: true,
            body: true,
        }),
    },
} as const
