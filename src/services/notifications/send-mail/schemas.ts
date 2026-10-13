import { validMailAddressDomains } from '@/services/mail/constants'
import { z } from 'zod'
import type Mail from 'nodemailer/lib/mailer'
import type React from 'react'

const dataFieldSchemas = z.object({
    from: z.string().email('Ikke en gyldig e-post').refine(
        address => validMailAddressDomains.some(domain => address.toLowerCase().endsWith(`@${domain}`)),
        `Avsenderen må være en adresse på ${validMailAddressDomains.join(' eller ')}`
    ),
    to: z.string().email('Ikke en gyldig e-post'),
    subject: z.string().min(2, 'Minimum 2 tegn').max(100, 'Maksimum 100 tegn'),
    text: z.string().min(2, 'Minimum 2 tegn'),
    body: z.custom<React.JSX.Element | string>(),
})

export const sendMailSchemas = {
    data: {
        sendMail: dataFieldSchemas.pick({
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
