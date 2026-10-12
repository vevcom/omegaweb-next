import { INFINITE_LOOP_PREVENTION_MAX_ITERATIONS } from './constants'
import { notificationMethodsArray } from '@/services/notifications/constants'
import { SpecialNotificationChannel } from '@/prisma-generated-pn-types'
import { z } from 'zod'
import type {
    ExpandedNotificationChannel,
    NotificationMethodGeneral
} from '@/services/notifications/types'

/**
 * Validates the available notification methods against the default methods.
 * @param availableMethods - The available notification methods.
 * @param defaultMethods - The default notification methods.
 * @returns A boolean indicating whether the available methods are valid.
 */
export function validateMethods(
    availableMethods: NotificationMethodGeneral,
    defaultMethods: NotificationMethodGeneral
): boolean {
    for (let i = 0; i < notificationMethodsArray.length; i++) {
        const availableMethod = availableMethods[notificationMethodsArray[i]]
        const defaultMethod = defaultMethods[notificationMethodsArray[i]]

        if (defaultMethod && !availableMethod) return false
    }

    return true
}

export function validateNewParent(
    channelId: number,
    newParentId: number,
    channels: ExpandedNotificationChannel[]
): boolean {
    return findValidParents(channelId, channels).map(channel => channel.id).includes(newParentId)
}

export function findValidParents(
    channelId: number,
    channels: ExpandedNotificationChannel[]
): ExpandedNotificationChannel[] {
    const validParents = channels.filter(channel => channel.id !== channelId)
    // Remove chrildren of the current channel
    const channelIDS = new Set(validParents.map(channel => channel.id))
    for (let i = 0; i < INFINITE_LOOP_PREVENTION_MAX_ITERATIONS; i++) {
        const lengthBeforeReduction = channelIDS.size

        for (let j = validParents.length - 1; j >= 0; j--) {
            if (!channelIDS.has(validParents[j].parentId)) {
                channelIDS.delete(validParents[j].id)
                validParents.splice(j, 1)
            }
        }

        // Quit the loop if the last round didn't remove any more parent
        if (lengthBeforeReduction === channelIDS.size) {
            break
        }

        if (i >= INFINITE_LOOP_PREVENTION_MAX_ITERATIONS - 1) {
            // It's highly unlikely that this wil ever throw
            throw new Error('Stopping infinite loop, while finding valid parents.')
        }
    }

    return validParents
}

const baseSchema = z.object({
    name: z.string().min(2),
    description: z.string(),
    special: z.nativeEnum(SpecialNotificationChannel),
    parentId: z.coerce.number().min(1),
    mailAliasId: z.coerce.number().min(1),
})

export const notificationChannelSchemas = {
    create: baseSchema.pick({
        name: true,
        description: true,
        parentId: true,
    }),

    update: baseSchema.pick({
        name: true,
        description: true,
        parentId: true,
        mailAliasId: true,
    }),
}
