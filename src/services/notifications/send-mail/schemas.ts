import { validMailAddressDomains } from '@/services/mail/constants'
import { z } from 'zod'
import type Mail from 'nodemailer/lib/mailer'
import type React from 'react'

const baseSchema = z.object({
    from: z.string().email('Ikke en gyldig e-post').refine(
        address => validMailAddressDomains.some(domain => address.toLowerCase().endsWith(`@${domain}`)),
        `Avsenderen må være en adresse på ${validMailAddressDomains.join(' eller ')}`
    ),
    to: z.string().email('Ikke en gyldig e-post'),
    subject: z.string().min(2, 'Minimum 2 tegn').max(100, 'Maksimum 100 tegn'),
    text: z.string().min(2, 'Minimum 2 tegn'),
})

export const sendMailSchemas = {
    sendMail: baseSchema.pick({
        from: true,
        to: true,
        subject: true,
        text: true,
    }),

    sendBulkMail: z.custom<Mail.Options>().array(),

    sendSystemMail: baseSchema.pick({
        to: true,
        subject: true,
    }).extend({
        body: z.custom<React.JSX.Element | string>(),
    }),
} as const
