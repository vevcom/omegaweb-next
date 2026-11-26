import '@ow-server-only'
import { chatSessionAuth } from './auth'
import { chatSessionSchemas } from './schemas'
import { defineOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import { CHAT_SESSION_CLIENT_ID, chatSignIn } from '@/services/chat/constants'
import { matrixUserIdOf } from '@/lib/chatSync/matrixUserId'

export const chatSessionOperations = {
    /**
     * What a user's browser signs in to the chat with: where it reaches the homeserver, the client it
     * is to the chat's sign in, and the Matrix id the user has, which is null until signing in has
     * given them their account. The app takes no other part in it and holds no token. Not found
     * where the chat pages sign nobody in.
     */
    read: defineOperation({
        paramsSchema: chatSessionSchemas.params.read,
        authorizer: ({ params }) => chatSessionAuth.read.data({ userId: params.userId }),
        operation: async ({ prisma, params }) => {
            if (!chatSignIn) throw new ServiceError('NOT FOUND', 'Chatten har ingen innlogging her')
            const chatUser = await prisma.chatUser.findUnique({
                where: { userId: params.userId },
                select: { localpart: true },
            })
            return {
                homeserverUrl: chatSignIn.homeserverOrigin,
                clientId: CHAT_SESSION_CLIENT_ID,
                matrixUserId: chatUser ? matrixUserIdOf(chatUser.localpart, chatSignIn.serverName) : null,
            }
        },
    }),
} as const
