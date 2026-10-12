import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { Session } from '@/auth/session/Session'
import { aliasOperations } from '@/services/mail/alias/operations'
import { mailingListOperations } from '@/services/mail/list/operations'
import { mailOperations } from '@/services/mail/operations'
import { COMMITTEE_PERMISSIONS } from '@/seeder/src/permissions'
import { afterEach, describe, expect, test } from '@jest/globals'
import type { Permission } from '@/prisma-generated-pn-types'

const sessionWith = (permissions: Permission[]) => Session.fromJsObject({
    memberships: [],
    permissions,
    user: null,
})

async function createAliasAndList(name: string) {
    const alias = await aliasOperations.create({
        data: { address: `test-${name}@omega.ntnu.no`, description: '' },
        bypassAuth: true,
    })
    const list = await mailingListOperations.create({
        data: { name: `test-${name}`, description: '' },
        bypassAuth: true,
    })
    return { alias, list }
}

afterEach(async () => {
    await prisma.mailingListUser.deleteMany()
    await prisma.mailAliasMailingList.deleteMany()
    await prisma.user.deleteMany({ where: { username: { startsWith: 'test-' } } })
    await prisma.mailAlias.deleteMany({ where: { address: { startsWith: 'test-' } } })
    await prisma.mailingList.deleteMany({ where: { name: { startsWith: 'test-' } } })
})

describe('mail server permissions', () => {
    test('committees can see the mail server but not change it', () => {
        expect(COMMITTEE_PERMISSIONS).toContain('MAILSERVER_USE')
        expect(COMMITTEE_PERMISSIONS).not.toContain('MAILSERVER_ADMIN')
    })

    test('MAILSERVER_USE cannot attach a list to an alias or add to a list', async () => {
        const { alias, list } = await createAliasAndList('use-denied')
        const user = await prisma.user.create({
            data: {
                username: 'test-use-denied',
                email: 'test-use-denied@test.test',
                bioParagraph: { create: {} },
                ledgerAccount: { create: { type: 'USER' } },
            },
        })
        const session = sessionWith(['MAILSERVER_USE'])

        await expect(mailOperations.createAliasMailingListRelation({
            data: { mailAliasId: alias.id, mailingListId: list.id },
            session,
        })).rejects.toThrow(Smorekopp)
        await expect(mailOperations.createMailingListUserRelation({
            data: { mailingListId: list.id, userId: user.id },
            session,
        })).rejects.toThrow(Smorekopp)
        expect(await prisma.mailAliasMailingList.count({ where: { mailAliasId: alias.id } })).toBe(0)
        expect(await prisma.mailingListUser.count({ where: { mailingListId: list.id } })).toBe(0)
    })

    test('MAILSERVER_ADMIN can attach and detach a list', async () => {
        const { alias, list } = await createAliasAndList('admin-allowed')
        const session = sessionWith(['MAILSERVER_ADMIN'])

        await mailOperations.createAliasMailingListRelation({
            data: { mailAliasId: alias.id, mailingListId: list.id },
            session,
        })
        expect(await prisma.mailAliasMailingList.count({ where: { mailAliasId: alias.id } })).toBe(1)

        await mailOperations.destroyAliasMailingListRelation({
            data: { mailAliasId: alias.id, mailingListId: list.id },
            session,
        })
        expect(await prisma.mailAliasMailingList.count({ where: { mailAliasId: alias.id } })).toBe(0)
    })
})
