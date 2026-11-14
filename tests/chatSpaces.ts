import { chatSpaceOperations } from '@/services/chat/spaces/subservice/operations'
import { prisma } from '@/prisma-pn-client-instance'
import type { ChatSpacePurpose } from '@/prisma-generated-pn-types'

/** A space as its service makes it, with the notification channels a row made by hand would lack. */
export async function createChatSpace({ name, purpose = 'MANUAL', memberChatUserIds = [], destroyed = false }: {
    name: string,
    purpose?: ChatSpacePurpose,
    memberChatUserIds?: number[],
    destroyed?: boolean,
}) {
    const space = await chatSpaceOperations.create.internalCall({
        prisma,
        data: { name },
        operationImplementationFields: { purpose },
    })
    return prisma.chatSpace.update({
        where: { id: space.id },
        data: {
            destroyedAt: destroyed ? new Date() : null,
            members: { create: memberChatUserIds.map(chatUserId => ({ chatUserId })) },
        },
    })
}
