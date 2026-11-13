import '@pn-server-only'
import { chatSpaceNotificationAuth } from './auth'
import { chatSpaceNotificationSchemas } from './schemas'
import {
    chatSpaceAllChannelMethods,
    chatSpaceChannelDescriptions,
    chatSpaceChannelNames,
    chatSpaceMentionsChannelMethods,
} from './constants'
import { chatNotificationChannel } from '@/services/chat/chatNotificationChannel'
import { implementNotificationChannelsForPurpose } from '@/services/notifications/channels/implementForPurpose'
import { defineSubOperation } from '@/services/serviceOperation'
import type { ChannelsOfPurposeConfig } from '@/services/notifications/channels/implementForPurpose'
import type { ChatSpace, NotificationChannelPurpose } from '@/prisma-generated-pn-types'

type ChatSpaceChannelIds = Pick<ChatSpace, 'mentionsNotificationChannelId' | 'allNotificationChannelId'>

const channels = {
    mentions: implementForSpaces('CHAT_SPACE_MENTIONS', 'mentionsNotificationChannelId', {
        parent: chatNotificationChannel,
        description: chatSpaceChannelDescriptions.mentions,
        availableMethods: chatSpaceMentionsChannelMethods,
    }),
    all: implementForSpaces('CHAT_SPACE_ALL', 'allNotificationChannelId', {
        parent: chatNotificationChannel,
        description: chatSpaceChannelDescriptions.all,
        availableMethods: chatSpaceAllChannelMethods,
    }),
} as const

/**
 * The two channels of a chat space: one for the messages that mention a user, and one for every
 * other message in its rooms. The space makes, renames and removes them through `internal`, and
 * what is sent in them is sent from there too.
 */
export const chatSpaceNotificationOperations = {
    internal: {
        createMentionsNotification: channels.mentions.internal.createNotification,
        createAllNotification: channels.all.internal.createNotification,

        /** The space's id must be known already, since the channels are named after it, so it is reserved first. */
        createChannels: defineSubOperation({
            paramsSchema: () => chatSpaceNotificationSchemas.params.createChannels,
            dataSchema: () => chatSpaceNotificationSchemas.data.createChannels,
            transaction: 'RUNS_IN',
            operation: () => async ({ params, data }): Promise<ChatSpaceChannelIds> => {
                const names = chatSpaceChannelNames(data.name, params.spaceId)
                const [mentions, all] = await Promise.all([
                    channels.mentions.internal.createAsConfigured.internalCall({ data: { name: names.mentions } }),
                    channels.all.internal.createAsConfigured.internalCall({ data: { name: names.all } }),
                ])
                return { mentionsNotificationChannelId: mentions.id, allNotificationChannelId: all.id }
            },
        }),

        renameChannels: defineSubOperation({
            paramsSchema: () => chatSpaceNotificationSchemas.params.renameChannels,
            dataSchema: () => chatSpaceNotificationSchemas.data.renameChannels,
            transaction: 'RUNS_IN',
            operation: () => async ({ prisma, params, data }): Promise<void> => {
                const space = await prisma.chatSpace.findUniqueOrThrow({
                    where: { id: params.spaceId },
                    select: { mentionsNotificationChannelId: true, allNotificationChannelId: true },
                })
                const names = chatSpaceChannelNames(data.name, params.spaceId)
                await Promise.all([
                    { id: space.mentionsNotificationChannelId, name: names.mentions },
                    { id: space.allNotificationChannelId, name: names.all },
                ].map(({ id, name }) => prisma.notificationChannel.update({ where: { id }, data: { name } })))
            },
        }),

        /** For once the space no longer points to them, which is to say once its row is deleted. */
        destroyChannels: defineSubOperation({
            paramsSchema: () => chatSpaceNotificationSchemas.params.destroyChannels,
            operation: () => async ({ params }): Promise<void> => {
                const { mentionsNotificationChannelId, allNotificationChannelId } = params
                await Promise.all([
                    channels.mentions.internal.destroy.internalCall({ params: { id: mentionsNotificationChannelId } }),
                    channels.all.internal.destroy.internalCall({ params: { id: allNotificationChannelId } }),
                ])
            },
        }),
    },
} as const

function implementForSpaces(
    purpose: NotificationChannelPurpose,
    channelKey: keyof ChatSpaceChannelIds,
    channelsConfig: ChannelsOfPurposeConfig,
) {
    return implementNotificationChannelsForPurpose({
        purpose,
        channels: channelsConfig,
        authorizers: {
            readMany: () => chatSpaceNotificationAuth.readManyChannels,
            createNotification: () => chatSpaceNotificationAuth.createNotification,
        },
        ownershipCheck: async ({ prisma, channelId }) =>
            await prisma.chatSpace.count({ where: { [channelKey]: channelId } }) > 0,
    })
}
