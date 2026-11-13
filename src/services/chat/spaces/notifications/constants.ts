import { allNotificationMethodsOn } from '@/services/notifications/constants'
import type { NotificationMethodGeneral } from '@/services/notifications/types'

export const chatSpaceMentionsChannelMethods: NotificationMethodGeneral = allNotificationMethodsOn

/** A mail per message is noise, so every message reaches a user by push or in the weekly mail alone. */
export const chatSpaceAllChannelMethods: NotificationMethodGeneral = {
    email: false,
    emailWeekly: true,
    push: true,
}

/** A channel's name is unique, so it carries the id of the space, which it keeps when the space is renamed. */
export function chatSpaceChannelNames(spaceName: string, spaceId: number) {
    const space = `${spaceName} (chat #${spaceId})`
    return {
        mentions: `${space}: omtaler`,
        all: `${space}: alle meldinger`,
    }
}

export const chatSpaceChannelDescriptions = {
    mentions: 'Meldinger som nevner deg eller hele rommet',
    all: 'Alle andre meldinger i rommene i chatområdet',
} as const
