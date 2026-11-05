import '@pn-server-only'
import { eventNotificationAuth } from './auth'
import { eventNotificationSchemas } from './schemas'
import { eventChannelDescriptions, eventInfoChannelMethods } from './constants'
import { eventNotificationChannel } from '@/services/events/eventNotificationChannel'
import { readEventAccess } from '@/services/events/access'
import { omegaEventLinks } from '@/app/(omegaweb)/events/links'
import { implementNotificationChannelsForPurpose } from '@/services/notifications/channels/implementForPurpose'
import { notificationSubscriptionOperations } from '@/services/notifications/subscription/operations'
import { validTransactionFilter } from '@/services/ledger/transactions/constants'
import { defineOperation, defineSubOperation } from '@/services/serviceOperation'
import type { Event, NotificationChannelPurpose } from '@/prisma-generated-pn-types'
import type { NotificationResult } from '@/services/notifications/types'

/** The channel operations per purpose of the channels an event owns. An event owns only its own. */
const channels = {
    own: implementForEvents('EVENT', 'notificationChannelId'),
    info: implementForEvents('EVENT_INFO', 'infoNotificationChannelId'),
    general: implementForEvents('EVENT_GENERAL', 'generalNotificationChannelId'),
} as const

/**
 * The notifications of an event, in the three channels it owns. What the organisers send is here;
 * the event's own operations send the rest, and make and remove the channels through `internal`.
 */
export const eventNotificationOperations = {
    /** A notification of the organisers' own in the general channel of the event, to the audience they pick. */
    createNotification: channels.general.createNotification,

    /**
     * Reminds those holding an unpaid place of a paid variant to pay, in the info channel. They are
     * named rather than resolved by the worker, which knows nothing of payment.
     */
    createPaymentReminder: defineOperation({
        paramsSchema: eventNotificationSchemas.params.createPaymentReminder,
        authorizer: async ({ params, prisma }) => eventNotificationAuth.createPaymentReminder.data(
            await readEventAccess(prisma, params.eventId)
        ),
        operation: async ({ prisma, params }): Promise<NotificationResult> => {
            const event = await prisma.event.findUniqueOrThrow({
                where: { id: params.eventId },
                select: { id: true, name: true, infoNotificationChannelId: true },
            })
            const unpaid = await prisma.eventRegistration.findMany({
                where: {
                    userId: { not: null },
                    state: 'IN_QUOTA',
                    manuallyPaid: false,
                    quota: { variant: { eventId: event.id, takesPayment: true } },
                    ledgerTransactions: { none: validTransactionFilter },
                },
                select: { userId: true },
            })
            const userIds = unpaid.flatMap(registration => (registration.userId === null ? [] : [registration.userId]))
            // No users would mean no restriction, so nothing is sent for nobody.
            if (userIds.length === 0) return { notification: null }

            return channels.info.internal.createNotification.internalCall({
                params: { channelId: event.infoNotificationChannelId },
                data: {
                    title: `Husk å betale for ${event.name}`,
                    message: `Du har plass på ${event.name}, men har ikke betalt for den ennå. `
                        + 'Betal på arrangementets side.',
                    url: omegaEventLinks.event(event),
                    audience: { userIds },
                },
            })
        },
    }),

    internal: {
        createOwnNotification: channels.own.internal.createNotification,
        createInfoNotification: channels.info.internal.createNotification,

        /**
         * The three channels of an event, under the EVENT channel. The event's id must be known
         * already, since the channels are named after it, so reserve it before the event is inserted.
         */
        createChannels: defineSubOperation({
            paramsSchema: () => eventNotificationSchemas.params.createChannels,
            dataSchema: () => eventNotificationSchemas.data.createChannels,
            operation: () => async ({ prisma, params, data }): Promise<EventChannelIds> => {
                const parent = await eventNotificationChannel.readChannelInternal({ prisma })
                const name = `${data.name} (#${params.eventId})`

                const own = await channels.own.internal.create.internalCall({
                    params: { availableMethods: parent.availableMethods },
                    data: { name, description: eventChannelDescriptions.own, parentId: parent.id },
                })
                const [info, general] = await Promise.all([
                    channels.info.internal.create.internalCall({
                        params: { availableMethods: eventInfoChannelMethods },
                        data: {
                            name: `${name}: viktig informasjon`,
                            description: eventChannelDescriptions.info,
                            parentId: own.id,
                        },
                    }),
                    channels.general.internal.create.internalCall({
                        params: { availableMethods: parent.availableMethods },
                        data: {
                            name: `${name}: annen informasjon`,
                            description: eventChannelDescriptions.general,
                            parentId: own.id,
                        },
                    }),
                ])

                return {
                    notificationChannelId: own.id,
                    infoNotificationChannelId: info.id,
                    generalNotificationChannelId: general.id,
                }
            },
        }),

        /** Deletes the channels of an event, once the event no longer points to them. */
        destroyChannels: defineSubOperation({
            paramsSchema: () => eventNotificationSchemas.params.destroyChannels,
            operation: () => async ({ params }): Promise<void> => {
                await Promise.all([
                    channels.info.internal.destroy.internalCall({ params: { id: params.infoNotificationChannelId } }),
                    channels.general.internal.destroy.internalCall({ params: { id: params.generalNotificationChannelId } }),
                ])
                await channels.own.internal.destroy.internalCall({ params: { id: params.notificationChannelId } })
            },
        }),

        /** Subscribes someone registering to the info channel of the event, unless they have settled it themselves. */
        subscribeToInfoChannel: defineSubOperation({
            paramsSchema: () => eventNotificationSchemas.params.subscribeToInfoChannel,
            operation: () => async ({ prisma, params }): Promise<void> => {
                const event = await prisma.event.findUniqueOrThrow({
                    where: { id: params.eventId },
                    select: { infoNotificationChannelId: true },
                })
                await notificationSubscriptionOperations.internal.subscribeByDefault.internalCall({
                    params: { userId: params.userId, channelId: event.infoNotificationChannelId },
                })
            },
        }),
    },
} as const

type EventChannelIds = Pick<Event, 'notificationChannelId' | 'infoNotificationChannelId' | 'generalNotificationChannelId'>

/** The channels of one purpose, owned by the event given as implementation params through the key named. */
function implementForEvents(purpose: NotificationChannelPurpose, channelKey: keyof EventChannelIds) {
    return implementNotificationChannelsForPurpose({
        purpose,
        implementationParamsSchema: eventNotificationSchemas.params.createNotification,
        authorizers: {
            readMany: () => eventNotificationAuth.readManyChannels,
            createNotification: async ({ prisma, implementationParams }) => eventNotificationAuth.createNotification.data(
                await readEventAccess(prisma, implementationParams.eventId)
            ),
        },
        ownershipCheck: async ({ prisma, channelId, implementationParams }) => {
            const event = await prisma.event.findUniqueOrThrow({
                where: { id: implementationParams.eventId },
                select: {
                    notificationChannelId: true,
                    infoNotificationChannelId: true,
                    generalNotificationChannelId: true,
                },
            })
            return event[channelKey] === channelId
        },
    })
}
