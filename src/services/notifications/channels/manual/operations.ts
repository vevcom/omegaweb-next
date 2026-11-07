import '@pn-server-only'
import { manualNotificationChannelAuth } from './auth'
import { implementNotificationChannelsForPurpose } from '@/services/notifications/channels/implementForPurpose'

const manualChannels = implementNotificationChannelsForPurpose({
    purpose: 'MANUAL',
    authorizers: {
        readMany: () => manualNotificationChannelAuth.readMany,
        createNotification: () => manualNotificationChannelAuth.createNotification,
    },
    // The admin pages own every manual channel, so the purpose is the whole check.
    ownershipCheck: () => true,
})

/**
 * The channels made on the admin pages. The special ones belong to the code and are neither changed
 * nor sent in from here, though a manual channel may be put under one.
 */
export const manualNotificationChannelOperations = {
    readMany: manualChannels.readMany,
    createNotification: manualChannels.createNotification,

    create: manualChannels.internal.create.implement({
        authorizer: () => manualNotificationChannelAuth.create,
        // A new channel is manual by construction, whatever its parent is.
        ownershipCheck: () => true,
    }),

    update: manualChannels.internal.update.implement({
        authorizer: () => manualNotificationChannelAuth.update,
        ownershipCheck: ({ prisma, params }) => manualChannels.ownsChannel({ prisma, channelId: params.id }),
    }),

    destroy: manualChannels.internal.destroy.implement({
        authorizer: () => manualNotificationChannelAuth.destroy,
        ownershipCheck: ({ prisma, params }) => manualChannels.ownsChannel({ prisma, channelId: params.id }),
    }),
} as const
