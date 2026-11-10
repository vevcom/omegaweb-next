import '@pn-server-only'
import { defaultNotificationAlias } from './constants'
import { getMailHandler } from './mailHandler'
import { sendMailSchemas } from './schemas'
import { defineSubOperation } from '@/services/serviceOperation'
import { render } from '@react-email/render'

/**
 * How the site sends mail: everything that leaves it by mail goes through these. They are
 * sub-operations with no access rule of their own, called with `internalCall` by the server code
 * that has a mail to send, which is the notification dispatchers and the system mails. Nobody
 * writes a mail here by hand: correspondence is written in the webmail as an alias, and what goes
 * out to many is a notification.
 */
export const sendMailOperations = {
    /** Sends fully specified mails, such as the rendered mails of the notification dispatchers. */
    sendBulkMail: defineSubOperation({
        dataSchema: () => sendMailSchemas.data.sendBulkMail,
        operation: () => async ({ data }) => {
            await getMailHandler().sendBulkMail(data)
        },
    }),

    /**
     * Sends a system mail: one mail to one address due to some system event, such as a forgotten
     * password. Must not be used as a notification.
     */
    sendSystemMail: defineSubOperation({
        dataSchema: () => sendMailSchemas.data.sendSystemMail,
        operation: () => async ({ data }) => {
            await getMailHandler().sendSingleMail({
                to: data.to,
                subject: data.subject,
                from: defaultNotificationAlias(),
                html: typeof data.body === 'string' ? data.body : await render(data.body),
            })
        },
    }),
} as const
