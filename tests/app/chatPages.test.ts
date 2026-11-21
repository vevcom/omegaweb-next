import { createChatSpace } from 'tests/chatSpaces'
import { appHref } from '@/lib/sites/href'
import { afterEach, beforeAll, describe, expect, test } from '@jest/globals'
import type { prisma as prismaClient } from '@/prisma-pn-client-instance'
import type { chatUserOperations as chatUserOperationsOfService } from '@/services/chat/users/operations'
import type { userOperations as userOperationsOfService } from '@/services/users/operations'
import type { chatLinks as chatLinksOfPages } from '@/app/(omegaweb)/chat/links'
import type { chatNavDef as chatNavDefOfPages } from '@/app/(omegaweb)/chat/chatNavDef'
import type { authorizeChatPage as authorizeChatPageOfPages } from '@/app/(omegaweb)/chat/authorizeChatPage'
import type { navDef as navDefOfSite } from '@/components/NavBar/navDef'
import type { Session as SessionClass } from '@/auth/session/Session'

type Loaded = {
    prisma: typeof prismaClient,
    chatUserOperations: typeof chatUserOperationsOfService,
    userOperations: typeof userOperationsOfService,
    chatLinks: typeof chatLinksOfPages,
    chatNavDef: typeof chatNavDefOfPages,
    authorizeChatPage: typeof authorizeChatPageOfPages,
    navDef: typeof navDefOfSite,
    Session: typeof SessionClass,
}
let loaded: Loaded

// Whether there is a chat, and its client, are read from the environment when the pages are loaded, so they are set first.
beforeAll(async () => {
    process.env.CHAT_AUTH_URL = 'https://account.chat.test'
    process.env.CHAT_CLIENT_URL = 'https://chat.test'
    loaded = {
        prisma: (await import('@/prisma-pn-client-instance')).prisma,
        chatUserOperations: (await import('@/services/chat/users/operations')).chatUserOperations,
        userOperations: (await import('@/services/users/operations')).userOperations,
        chatLinks: (await import('@/app/(omegaweb)/chat/links')).chatLinks,
        chatNavDef: (await import('@/app/(omegaweb)/chat/chatNavDef')).chatNavDef,
        authorizeChatPage: (await import('@/app/(omegaweb)/chat/authorizeChatPage')).authorizeChatPage,
        navDef: (await import('@/components/NavBar/navDef')).navDef,
        Session: (await import('@/auth/session/Session')).Session,
    }
})

afterEach(async () => {
    await loaded.prisma.chatSpace.deleteMany()
    await loaded.prisma.user.deleteMany({ where: { email: { endsWith: '@chat-pages.test' } } })
    await loaded.prisma.chatUser.deleteMany({ where: { userId: null } })
})

async function createUser(username: string) {
    const created = await loaded.prisma.user.create({
        data: {
            username,
            email: `${username}@chat-pages.test`,
            firstname: 'Kari',
            lastname: 'Nordmann',
            bioParagraph: { create: {} },
            ledgerAccount: { create: { type: 'USER' } },
            chatUser: { create: { localpart: username } },
        },
        select: { id: true, chatUser: { select: { id: true } } },
    })
    const user = await loaded.userOperations.read({ params: { id: created.id }, bypassAuth: true })
    return {
        user,
        chatUserId: created.chatUser!.id,
        session: loaded.Session.fromJsObject({ user, permissions: [], memberships: [] }),
    }
}

const visitor = () => loaded.Session.empty()
const companyUser = () => loaded.Session.fromJsObject({
    user: null,
    companyUser: {
        id: 1,
        email: 'kari@example.com',
        firstname: 'Kari',
        lastname: 'Nordmann',
        admin: false,
        company: { id: 1, name: 'Chattest AS' },
    },
    permissions: [],
    memberships: [],
})

describe('the chat pages', () => {
    test('are linked to under /chat', () => {
        expect(loaded.chatLinks.messages()).toBe('/chat')
        expect(loaded.chatLinks.directMessage({ username: 'kari' })).toBe('/chat/messages/kari')
        expect(loaded.chatLinks.spaces()).toBe('/chat/spaces')
        expect(loaded.chatLinks.settings()).toBe('/chat/settings')
        expect(loaded.chatLinks.signIn()).toBe('/chat/sign-in')
        expect(loaded.chatLinks.signOut(appHref('/career/logout'))).toBe('/chat/sign-out?callbackUrl=%2Fcareer%2Flogout')
    })

    test('are a user\'s own, with the chat client as the last item of their navigation', async () => {
        const { user, session } = await createUser('chat-sider')
        expect(loaded.authorizeChatPage(session)).toMatchObject({ id: user.id })
        expect((await loaded.chatNavDef({ userId: user.id }).visible(session)).map(link => link.href))
            .toEqual(['/chat', '/chat/spaces', '/chat/settings', 'https://chat.test'])
        expect((await loaded.navDef.visible(session)).map(link => link.key)).toContain('chat')
    })

    test('are nobody else\'s to open, also not a user admin\'s', async () => {
        const { user } = await createUser('chat-sider-eier')
        const other = await createUser('chat-sider-annen')
        const admin = loaded.Session.fromJsObject({
            user: other.user,
            permissions: ['USERS_ADMIN', 'NOTIFICATION_ADMIN'],
            memberships: [],
        })
        await expect(loaded.chatNavDef({ userId: user.id }).visible(other.session)).resolves.toEqual([])
        await expect(loaded.chatNavDef({ userId: user.id }).visible(admin)).resolves.toEqual([])
    })

    test('are not for a visitor, who is sent to sign in', async () => {
        expect(() => loaded.authorizeChatPage(visitor())).toThrow(expect.objectContaining({ errorCode: 'UNAUTHENTICATED' }))
        await expect(loaded.chatNavDef({ userId: 1 }).visible(visitor())).resolves.toEqual([])
        expect((await loaded.navDef.visible(visitor())).map(link => link.key)).not.toContain('chat')
    })

    test('are not for a company user', async () => {
        expect(() => loaded.authorizeChatPage(companyUser())).toThrow(expect.objectContaining({ errorCode: 'UNAUTHORIZED' }))
        await expect(loaded.chatNavDef({ userId: 1 }).visible(companyUser())).resolves.toEqual([])
        expect((await loaded.navDef.visible(companyUser())).map(link => link.key)).not.toContain('chat')
    })
})

describe('the spaces of a chat user', () => {
    test('open in the chat client once they are on the homeserver, and so do their rooms', async () => {
        const { user, chatUserId, session } = await createUser('chat-lenker')
        const space = await createChatSpace({ name: 'Vevcom', memberChatUserIds: [chatUserId] })
        await loaded.prisma.chatSpace.update({ where: { id: space.id }, data: { matrixRoomId: '!vevcom:chat.test' } })
        await loaded.prisma.chatSpaceRoom.createMany({
            data: [
                { spaceId: space.id, name: 'Prat', matrixRoomId: '!prat:chat.test' },
                { spaceId: space.id, name: 'Ny' },
            ],
        })

        await expect(loaded.chatUserOperations.readSpaces({ params: { userId: user.id }, session }))
            .resolves.toMatchObject([{
                matrixRoomId: '!vevcom:chat.test',
                url: 'https://chat.test/#/room/!vevcom:chat.test',
                rooms: [
                    { name: 'Prat', matrixRoomId: '!prat:chat.test', url: 'https://chat.test/#/room/!prat:chat.test' },
                    { name: 'Ny', matrixRoomId: null, url: null },
                ],
            }])
    })
})
