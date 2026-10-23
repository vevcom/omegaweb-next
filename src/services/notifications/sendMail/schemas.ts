import { validMailAddressDomains } from '@/services/mail/constants'
import { z } from 'zod'
import { zfd } from 'zod-form-data'
import type Mail from 'nodemailer/lib/mailer'
import type React from 'react'

const dataFieldSchemas = z.object({
    from: z.string().email('Ikke en gyldig e-post').refine(
        address => validMailAddressDomains.some(domain => address.toLowerCase().endsWith(`@${domain}`)),
        `Avsenderen må være en adresse på ${validMailAddressDomains.join(' eller ')}`
    ),
    to: z.string().email('Ikke en gyldig e-post'),
    // Typed as one field, separated by commas, semicolons, spaces or new lines.
    recipients: z.string().default('').transform(value => value.split(/[\s,;]+/).filter(Boolean)).pipe(
        z.string().email('Ikke en gyldig e-post').array()
    ),
    // The form posts one checkbox per list, so none or a single one arrives as no value or a lone string.
    mailingListIds: zfd.repeatable(z.coerce.number().int().min(1).array()),
    subject: z.string().min(2, 'Minimum 2 tegn').max(100, 'Maksimum 100 tegn'),
    text: z.string().min(2, 'Minimum 2 tegn'),
    body: z.custom<React.JSX.Element | string>(),
})

export const sendMailSchemas = {
    data: {
        sendMail: dataFieldSchemas.pick({
            from: true,
            recipients: true,
            mailingListIds: true,
            subject: true,
            text: true,
        }),
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
