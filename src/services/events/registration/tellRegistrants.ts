import '@ow-server-only'
import { eventNotificationOperations } from '@/services/events/notifications/operations'
import { eventHomeLinks } from '@/pageKits/events/links'
import { sendMailOperations } from '@/services/mail/send/operations'
import logger from '@/lib/logger'
import type { EventKind } from '@/prisma-generated-pn-types'

type Told = {
    userId: number | null,
    contact: { email: string | null } | null,
    message: string,
    /** The message as the html of a mail, with what came from users escaped. */
    mailBody: string,
}

/**
 * Tells those registered to an event each their own message under one title: users in the info
 * channel of the event, one notification for each message, and guests by mail to the address they
 * left, if any. A notice that fails is logged and the rest are still sent, since what they are told
 * of is saved already: call it only once it is.
 */
export async function tellRegistrants(
    event: { id: number, kind: EventKind, name: string, infoNotificationChannelId: number },
    title: string,
    told: Told[],
) {
    const usersByMessage = new Map<string, number[]>()
    for (const { userId, message } of told) {
        if (userId === null) continue
        usersByMessage.set(message, [...usersByMessage.get(message) ?? [], userId])
    }
    for (const [message, userIds] of Array.from(usersByMessage)) {
        try {
            await eventNotificationOperations.internal.createInfoNotification.internalCall({
                params: { channelId: event.infoNotificationChannelId },
                data: { title, message, url: eventHomeLinks(event).event(event), audience: { userIds } },
            })
        } catch (error) {
            logger.error(`Could not notify users ${userIds.join(', ')} of "${title}"`, { error })
        }
    }

    const guests = told.flatMap(({ contact, mailBody }) => (contact?.email ? [{ email: contact.email, mailBody }] : []))
    const sendings = await Promise.allSettled(guests.map(({ email, mailBody }) => (
        sendMailOperations.sendSystemMail.internalCall({ data: { to: email, subject: title, body: mailBody } })
    )))
    sendings.forEach((sending, index) => {
        if (sending.status === 'rejected') {
            const error: unknown = sending.reason
            logger.error(`Could not mail ${guests[index].email} "${title}"`, { error })
        }
    })
}
