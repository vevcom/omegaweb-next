import '@pn-server-only'
import { chatSpaceSchemas } from './schemas'
import { defineSubOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import type { ChatSpacePurpose } from '@/prisma-generated-pn-types'

const liveSpace = (spaceId: number) => ({ id: spaceId, destroyedAt: null })

/**
 * The spaces of the chat. A space is owned by the service that implements these, which its purpose
 * names. The operations only write rows: the chat sync (src/lib/chatSync) is what makes the
 * homeserver follow, within the interval of the chat worker.
 */
export const chatSpaceOperations = {
    create: defineSubOperation({
        dataSchema: () => chatSpaceSchemas.data.create,
        operation: ({ purpose }: { purpose: ChatSpacePurpose }) =>
            ({ prisma, data }) => prisma.chatSpace.create({ data: { purpose, name: data.name } }),
    }),

    read: defineSubOperation({
        paramsSchema: () => chatSpaceSchemas.params.read,
        operation: () => async ({ prisma, params }) => {
            const space = await prisma.chatSpace.findFirst({ where: liveSpace(params.spaceId) })
            if (!space) throw new ServiceError('NOT FOUND', 'Fant ikke chatområdet')
            return space
        },
    }),

    /** Those picked for the space, with whether their account is on the homeserver yet. */
    readMembers: defineSubOperation({
        paramsSchema: () => chatSpaceSchemas.params.readMembers,
        operation: () => async ({ prisma, params }) => {
            const members = await prisma.chatSpaceMember.findMany({
                where: { spaceId: params.spaceId, chatUser: { user: { isNot: null } } },
                select: {
                    chatUser: {
                        select: {
                            syncedName: true,
                            user: { select: { id: true, username: true, firstname: true, lastname: true } },
                        },
                    },
                },
                orderBy: { createdAt: 'asc' },
            })
            return members.map(({ chatUser }) => ({ ...chatUser.user!, onHomeserver: chatUser.syncedName !== null }))
        },
    }),

    update: defineSubOperation({
        paramsSchema: () => chatSpaceSchemas.params.update,
        dataSchema: () => chatSpaceSchemas.data.update,
        operation: () => ({ prisma, params, data }) => prisma.chatSpace.update({
            where: liveSpace(params.spaceId),
            data: { name: data.name },
        }),
    }),

    /** Marks the space destroyed. The chat sync takes everyone out of it and then deletes the row. */
    destroy: defineSubOperation({
        paramsSchema: () => chatSpaceSchemas.params.destroy,
        operation: () => async ({ prisma, params }) => {
            await prisma.chatSpace.update({ where: liveSpace(params.spaceId), data: { destroyedAt: new Date() } })
        },
    }),

    /** Only those with a chat account can be members, which is to say those who have signed in to the chat. */
    addMembers: defineSubOperation({
        paramsSchema: () => chatSpaceSchemas.params.addMembers,
        dataSchema: () => chatSpaceSchemas.data.addMembers,
        operation: () => async ({ prisma, params, data }) => {
            const chatUsers = await prisma.chatUser.findMany({
                where: { userId: { in: data.userIds }, deactivatedAt: null },
                select: { id: true },
            })
            if (chatUsers.length < new Set(data.userIds).size) {
                throw new ServiceError('BAD DATA', 'Bare de som har logget inn på chatten kan legges til')
            }
            await prisma.chatSpaceMember.createMany({
                data: chatUsers.map(chatUser => ({ spaceId: params.spaceId, chatUserId: chatUser.id })),
                skipDuplicates: true,
            })
        },
    }),

    /** An admin of the space who is removed is put back by the chat sync, see src/lib/chatSync/spaces.ts. */
    removeMembers: defineSubOperation({
        paramsSchema: () => chatSpaceSchemas.params.removeMembers,
        dataSchema: () => chatSpaceSchemas.data.removeMembers,
        operation: () => async ({ prisma, params, data }) => {
            await prisma.chatSpaceMember.deleteMany({
                where: { spaceId: params.spaceId, chatUser: { userId: { in: data.userIds } } },
            })
        },
    }),
} as const
