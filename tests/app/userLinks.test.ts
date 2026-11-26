import { chatLinks } from '@/app/(omegaweb)/chat/links'
import { omegaLinks, usernameOfPage } from '@/app/(omegaweb)/links'
import { getProfileForUserPage } from '@/app/(omegaweb)/users/[username]/(user-pages)/getProfileForUserPage'
import { userNavDef } from '@/app/(omegaweb)/users/[username]/userNavDef'
import { userOperations } from '@/services/users/operations'
import { withServiceContext } from '@/services/serviceOperation'
import { prisma } from '@/prisma-pn-client-instance'
import { Session } from '@/auth/session/Session'
import { afterEach, describe, expect, test } from '@jest/globals'

// Nothing keeps these out of a username, and each of them means something in a url.
const username = 'kari#ola/per?x%y'
const segment = 'kari%23ola%2Fper%3Fx%25y'

afterEach(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: '@user-links.test' } } })
})

describe('a link to a user', () => {
    test('holds the username as one segment of the path, whatever is in it', () => {
        expect(omegaLinks.user({ username })).toBe(`/users/${segment}`)
        expect(omegaLinks.userNotifications({ username })).toBe(`/users/${segment}/notifications`)
        expect(chatLinks.directMessage({ username })).toBe(`/chat/messages/${segment}`)
    })

    test('holds it so in every item of the user\'s navigation too', () => {
        const hrefs = userNavDef({ username, userId: 1 }).all.items.map(item => String(item.href))
        expect(hrefs.filter(href => href !== `/users/${segment}` && !href.startsWith(`/users/${segment}/`))).toEqual([])
    })

    test('is read back by the pages, which Next hands the segment encoded', () => {
        expect(usernameOfPage({ username: segment })).toBe(username)
        // Next encodes more than a link needs to.
        expect(usernameOfPage({ username: 'kari%40ola' })).toBe('kari@ola')
    })

    test('leads to the user, whose pages read the username so', async () => {
        const created = await prisma.user.create({
            data: {
                username,
                email: 'kari@user-links.test',
                firstname: 'Kari',
                lastname: 'Nordmann',
                bioParagraph: { create: {} },
                ledgerAccount: { create: { type: 'USER' } },
            },
        })
        const user = await userOperations.read({ params: { id: created.id }, bypassAuth: true })
        const session = Session.fromJsObject({ user, permissions: [], memberships: [] })

        // The session reaches the operations as it does from serverPage.
        const { profile } = await withServiceContext({ session }, 'NONE', () =>
            getProfileForUserPage({ username: segment }, 'settings', session)
        )
        expect(profile.user.id).toBe(created.id)
    })
})
