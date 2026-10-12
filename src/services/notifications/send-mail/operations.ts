import '@pn-server-only'
import { sendMailAuth } from './auth'
import { sendMailSchemas } from './schemas'
import { getMailHandler } from '@/lib/email/mailHandler'
import { defineSubOperation } from '@/services/serviceOperation'
import { render } from '@react-email/render'

/**
 * The raw mail senders, only callable from other server code via internalCall. Everything that
 * leaves the site by mail goes through these.
 */
const internal = {
    /** Sends one simple text mail. Implemented with authorization as `sendMail` below. */
    sendMail: defineSubOperation({
        dataSchema: () => sendMailSchemas.sendMail,
        operation: () => async ({ data }) => {
            await getMailHandler().sendSingleMail(data)
        },
    }),

    /** Sends many fully specified mails, e.g. the notification worker's rendered html mails. */
    sendBulkMail: defineSubOperation({
        dataSchema: () => sendMailSchemas.sendBulkMail,
        operation: () => async ({ data }) => {
            await getMailHandler().sendBulkMail(data)
        },
    }),

    /**
     * Sends a system email: one mail to one user due to some system event, such as forgot
     * password. Must not be used as a notification.
     */
    sendSystemMail: defineSubOperation({
        dataSchema: () => sendMailSchemas.sendSystemMail,
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
