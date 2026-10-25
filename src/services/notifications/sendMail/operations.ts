import '@pn-server-only'
import { sendMailAuth } from './auth'
import { sendMailSchemas } from './schemas'
import { getMailHandler } from '@/lib/email/mailHandler'
import { defineSubOperation } from '@/services/serviceOperation'
import { resolveMailRecipients } from '@/services/mail/recipients'
import { replaceSpecialSymbols } from '@/services/notifications/methods/helpers'
import { Smorekopp } from '@/services/error'
import { render } from '@react-email/render'
import type { UserBasic } from '@/services/users/types'

/** An address with no user has nothing to fill the placeholders with, so they are left out. */
function fillInPlaceholders(text: string, user: UserBasic | null) {
    return user ? replaceSpecialSymbols(text, user) : text.replace(/%[unN]/g, '')
}

/**
 * The raw mail senders, only callable from other server code via internalCall. Everything that
 * leaves the site by mail goes through these.
 */
const internal = {
    /**
     * Sends a text mail to typed addresses and mailing lists. Each recipient gets a mail of their own,
     * so nobody sees who else got it and the placeholders can be filled in per recipient.
     * Implemented with authorization as `sendMail` below.
     */
    sendMail: defineSubOperation({
        dataSchema: () => sendMailSchemas.data.sendMail,
        operation: () => async ({ prisma, data }) => {
            const recipients = await resolveMailRecipients(prisma, {
                addresses: data.recipients,
                mailingListIds: data.mailingListIds,
            })
            if (recipients.length === 0) {
                throw new Smorekopp('BAD PARAMETERS', 'Fant ingen mottakere. Skriv inn en adresse eller velg en liste.')
            }

            await getMailHandler().sendBulkMail(recipients.map(recipient => ({
                from: data.from,
                to: recipient.address,
                subject: fillInPlaceholders(data.subject, recipient.user),
                text: fillInPlaceholders(data.text, recipient.user),
            })))
            return { recipientCount: recipients.length }
        },
    }),

    /** Sends many fully specified mails, e.g. the notification worker's rendered html mails. */
    sendBulkMail: defineSubOperation({
        dataSchema: () => sendMailSchemas.data.sendBulkMail,
        operation: () => async ({ data }) => {
            await getMailHandler().sendBulkMail(data)
        },
    }),

    /**
     * Sends a system email: one mail to one user due to some system event, such as forgot
     * password. Must not be used as a notification.
     */
    sendSystemMail: defineSubOperation({
        dataSchema: () => sendMailSchemas.data.sendSystemMail,
        operation: () => async ({ data }) => {
            await getMailHandler().sendSingleMail({
                to: data.to,
                subject: data.subject,
                from: `noreply@${process.env.EMAIL_DOMAIN}`,
                html: (typeof data.body === 'string') ? data.body : await render(data.body),
            })
        },
    }),
} as const

export const sendMailOperations = {
    internal,

    sendMail: internal.sendMail.implement({
        authorizer: () => sendMailAuth.sendMail,
        ownershipCheck: () => true,
        implementationParamsSchema: undefined,
        dataSchemaImplementationFields: undefined,
        paramsSchemaImplementationFields: undefined,
        operationImplementationFields: undefined,
    }),
} as const
