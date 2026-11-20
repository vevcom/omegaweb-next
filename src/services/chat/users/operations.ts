import '@ow-server-only'
import { chatUserAuth } from './auth'
import { chatUserSchemas } from './schemas'
import { CHAT_LOCALPART_ATTEMPTS, chatLocalpartAt, isReservedChatLocalpart } from './localpart'
import { chatPictureOf } from './picture'
import { chatProfileImageCollection } from './chatProfileImageCollection'
import { defineOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import { expandedImageIncluder } from '@/services/images/subservice/constants'
import { allNotificationMethodsOn } from '@/services/notifications/constants'
import { chatClientOrigin } from '@/services/chat/constants'
import { chatServer } from '@/lib/chatSync/constants'

const subscribableChannel = {
    select: { id: true, name: true, description: true, availableMethods: { select: allNotificationMethodsOn } },
} as const

const NO_ACCOUNT = 'Brukeren har ingen chatkonto'

const urlOfRoom = (matrixRoomId: string | null) => (
    chatClientOrigin && matrixRoomId ? `${chatClientOrigin}/#/room/${matrixRoomId}` : null
)

export const chatUserOperations = {
    /**
     * Gives a user their account on the chat, which is how they opt in to it: the provider calls
     * this when they sign in to the chat, see src/services/auth/oidc/clients.ts. Their localpart is
     * their username as a Matrix id takes it, with a number after it when that is taken. A user who
     * has an account keeps it as it is, so it is called at every sign in.
     */
    optIn: defineOperation({
        paramsSchema: chatUserSchemas.params.optIn,
        authorizer: ({ params }) => chatUserAuth.optIn.data({ userId: params.userId }),
        operation: async ({ prisma, params }) => {
            const existing = await prisma.chatUser.findUnique({ where: { userId: params.userId } })
            if (existing) return existing

            const user = await prisma.user.findUniqueOrThrow({
                where: { id: params.userId },
                select: { id: true, username: true },
            })
            for (let attempt = 0; attempt < CHAT_LOCALPART_ATTEMPTS; attempt++) {
                const localpart = chatLocalpartAt(user, attempt)
                if (isReservedChatLocalpart(localpart)) continue
                const taken = await prisma.chatUser.findUnique({ where: { localpart }, select: { id: true } })
                if (taken) continue
                // Two sign ins of the same user at once both end up here, and the second gets the first's row.
                return prisma.chatUser.upsert({
                    where: { userId: user.id },
                    create: { userId: user.id, localpart },
                    update: {},
                })
            }
            throw new ServiceError('SERVER ERROR', `Fant ikke noe ledig brukernavn på chatten til ${user.username}`)
        },
    }),

    /** A user's account on the chat. Not found for a user who has not signed in to it. */
    read: defineOperation({
        paramsSchema: chatUserSchemas.params.read,
        authorizer: ({ params }) => chatUserAuth.read.data({ userId: params.userId }),
        operation: async ({ prisma, params }) => {
            const chatUser = await prisma.chatUser.findUnique({ where: { userId: params.userId } })
            if (!chatUser) throw new ServiceError('NOT FOUND', NO_ACCOUNT)
            return chatUser
        },
    }),

    /**
     * The spaces a user is in, each with its two notification channels and the rooms the user is
     * let into, and where the chat client opens them. None for one who has not signed in to the chat.
     */
    readSpaces: defineOperation({
        paramsSchema: chatUserSchemas.params.readSpaces,
        authorizer: ({ params }) => chatUserAuth.readSpaces.data({ userId: params.userId }),
        operation: async ({ prisma, params }) => {
            const ofUser = { userId: params.userId }
            const chatUser = await prisma.chatUser.findUnique({
                where: ofUser,
                select: {
                    spaceMemberships: {
                        where: { space: { destroyedAt: null } },
                        select: {
                            space: {
                                select: {
                                    id: true,
                                    name: true,
                                    matrixRoomId: true,
                                    committee: { select: { shortName: true } },
                                    mentionsNotificationChannel: subscribableChannel,
                                    allNotificationChannel: subscribableChannel,
                                    rooms: {
                                        where: {
                                            destroyedAt: null,
                                            OR: [
                                                { isPrivate: false },
                                                { pickedMembers: { some: { spaceMember: { chatUser: ofUser } } } },
                                            ],
                                        },
                                        select: { id: true, name: true, isPrivate: true, matrixRoomId: true },
                                        orderBy: { id: 'asc' },
                                    },
                                },
                            },
                        },
                        orderBy: { space: { name: 'asc' } },
                    },
                },
            })
            return chatUser?.spaceMemberships.map(({ space: { matrixRoomId, rooms, ...space } }) => ({
                ...space,
                url: urlOfRoom(matrixRoomId),
                rooms: rooms.map(({ matrixRoomId: roomId, ...room }) => ({ ...room, url: urlOfRoom(roomId) })),
            })) ?? []
        },
    }),

    readPicture: defineOperation({
        paramsSchema: chatUserSchemas.params.readPicture,
        authorizer: ({ params }) => chatUserAuth.readPicture.data({ userId: params.userId }),
        operation: async ({ prisma, params }) => {
            const chatUser = await prisma.chatUser.findUnique({
                where: { userId: params.userId },
                select: {
                    image: { include: expandedImageIncluder },
                    user: { select: { image: { include: expandedImageIncluder } } },
                },
            })
            if (!chatUser) throw new ServiceError('NOT FOUND', NO_ACCOUNT)
            return chatPictureOf(chatUser)
        },
    }),

    /** Gives a user's account a picture of its own, in place of the one it had. */
    updatePicture: defineOperation({
        paramsSchema: chatUserSchemas.params.updatePicture,
        dataSchema: chatUserSchemas.data.updatePicture,
        authorizer: ({ params }) => chatUserAuth.updatePicture.data({ userId: params.userId }),
        transaction: 'OPENS',
        operation: async ({ prisma, params, data }) =>
            // The upload writes the file before the database, so it needs more than the default
            // transaction timeout.
            prisma.$transaction(async tx => {
                const chatUser = await tx.chatUser.findUnique({
                    where: { userId: params.userId },
                    select: { id: true, imageId: true, user: { select: { firstname: true, lastname: true } } },
                })
                if (!chatUser?.user) throw new ServiceError('NOT FOUND', NO_ACCOUNT)

                const uploadedImage = await chatProfileImageCollection.internal.uploadImage.internalCall({
                    prisma: tx,
                    data: {
                        imageFile: data.imageFile,
                        imageName: 'Chatbilde',
                        imageAlt: `Chatbilde av ${chatUser.user.firstname} ${chatUser.user.lastname}`.slice(0, 100),
                    },
                })
                await tx.chatUser.update({ where: { id: chatUser.id }, data: { imageId: uploadedImage.id } })
                if (chatUser.imageId !== null) {
                    await chatProfileImageCollection.internal.destroyImage.internalCall({
                        prisma: tx,
                        params: { imageId: chatUser.imageId },
                    })
                }
                return uploadedImage
            }, { timeout: 20000 }),
    }),

    /** Takes away the picture of a user's account, which then has the user's profile image. */
    destroyPicture: defineOperation({
        paramsSchema: chatUserSchemas.params.destroyPicture,
        authorizer: ({ params }) => chatUserAuth.destroyPicture.data({ userId: params.userId }),
        operation: async ({ prisma, params }) => {
            const chatUser = await prisma.chatUser.findUnique({
                where: { userId: params.userId },
                select: { imageId: true },
            })
            if (!chatUser) throw new ServiceError('NOT FOUND', NO_ACCOUNT)
            if (chatUser.imageId === null) return
            await chatProfileImageCollection.internal.destroyImage.internalCall({
                prisma,
                params: { imageId: chatUser.imageId },
            })
        },
    }),

    /**
     * Whether a user is on the chat to be written to, and where the chat client opens a direct
     * message with them. No url for a user without an account there, nor where the client or the
     * server name is unset.
     */
    readDirectMessage: defineOperation({
        paramsSchema: chatUserSchemas.params.readDirectMessage,
        authorizer: () => chatUserAuth.readDirectMessage,
        operation: async ({ prisma, params }) => {
            const chatUser = await prisma.chatUser.findUnique({
                where: { userId: params.userId, deactivatedAt: null },
                select: { localpart: true },
            })
            const { serverName } = chatServer
            return {
                isOnChat: chatUser !== null,
                url: chatUser && chatClientOrigin && serverName
                    ? `${chatClientOrigin}/#/user/@${chatUser.localpart}:${serverName}?action=chat`
                    : null,
            }
        },
    }),
} as const
