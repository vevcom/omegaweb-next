import type { NotificationMethodGeneral } from '@/services/notifications/types'

/** A message is read when it is written or not at all, so neither channel is held for the weekly mail. */
export const chatSpaceMentionsChannelMethods: NotificationMethodGeneral = {
    email: true,
    emailWeekly: false,
    push: true,
}

/** A mail per message is noise, so every message reaches a user by push alone. */
export const chatSpaceAllChannelMethods: NotificationMethodGeneral = {
    email: false,
    emailWeekly: false,
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
