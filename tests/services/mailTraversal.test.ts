import { prisma } from '@/prisma-pn-client-instance'
import { omegaOrderOperations } from '@/services/omegaOrder/operations'
import { aliasOperations } from '@/services/mail/alias/operations'
import { mailingListOperations } from '@/services/mail/list/operations'
import { mailAddressExternalOperations } from '@/services/mail/mailAddressExternal/operations'
import { mailOperations } from '@/services/mail/operations'
import { userBasicSelection } from '@/services/users/constants'
import { beforeAll, describe, expect, test } from '@jest/globals'
import type { Group, MailingList } from '@/prisma-generated-pn-types'
import type { MailListTypes, ViaType } from '@/services/mail/types'

/**
 * Builds the graph every test reads from. Every node is reachable along more than one path,
 * so both the ordering of the results and the merging of `via` entries are exercised.
 *
 *   aliasA  -> listOne, listTwo
 *   aliasB  -> listOne
 *   listOne -> group, firstUser (directly), external
 *   listTwo -> group, secondUser (directly), external
 *   group   -> firstUser, secondUser (memberships)
 *
 * Rows are created in id order so the expected ordering does not depend on how the database scans them.
 * The records are read back afterwards so they are compared in the exact shape the traversal returns.
 */
async function createGraph() {
    const { order } = await omegaOrderOperations.readCurrent({ bypassAuth: true })
    const groupId = (await prisma.group.create({ data: { groupType: 'MANUAL_GROUP', order } })).id
    const firstUserId = (await prisma.user.create({
        data: {
            username: 'traversal-first',
            email: 'traversal-first@test.test',
            bioParagraph: { create: {} },
            ledgerAccount: { create: { type: 'USER' } },
        },
    })).id
    const secondUserId = (await prisma.user.create({
        data: {
            username: 'traversal-second',
            email: 'traversal-second@test.test',
            bioParagraph: { create: {} },
            ledgerAccount: { create: { type: 'USER' } },
        },
    })).id
    await prisma.membership.create({ data: { userId: firstUserId, groupId, admin: false, active: true, order } })
    await prisma.membership.create({ data: { userId: secondUserId, groupId, admin: false, active: true, order } })

    const aliasAId = (await aliasOperations.create({
        data: { address: 'traversal-a@omega.ntnu.no', description: '' },
        bypassAuth: true,
    })).id
    const aliasBId = (await aliasOperations.create({
        data: { address: 'traversal-b@omega.ntnu.no', description: '' },
        bypassAuth: true,
    })).id
    const listOneId = (await mailingListOperations.create({
        data: { name: 'traversal-list-one', description: '' },
        bypassAuth: true,
    })).id
    const listTwoId = (await mailingListOperations.create({
        data: { name: 'traversal-list-two', description: '' },
        bypassAuth: true,
    })).id
    const externalId = (await mailAddressExternalOperations.create({
        data: { address: 'traversal@gmail.com', description: '' },
        bypassAuth: true,
    })).id

    await mailOperations.createAliasMailingListRelation({
        data: { mailAliasId: aliasAId, mailingListId: listOneId },
        bypassAuth: true,
    })
    await mailOperations.createAliasMailingListRelation({
        data: { mailAliasId: aliasAId, mailingListId: listTwoId },
        bypassAuth: true,
    })
    await mailOperations.createAliasMailingListRelation({
        data: { mailAliasId: aliasBId, mailingListId: listOneId },
        bypassAuth: true,
    })
    await mailOperations.createMailingListGroupRelation({
        data: { mailingListId: listOneId, groupId },
        bypassAuth: true,
    })
    await mailOperations.createMailingListGroupRelation({
        data: { mailingListId: listTwoId, groupId },
        bypassAuth: true,
    })
    await mailOperations.createMailingListUserRelation({
        data: { mailingListId: listOneId, userId: firstUserId },
        bypassAuth: true,
    })
    await mailOperations.createMailingListUserRelation({
        data: { mailingListId: listTwoId, userId: secondUserId },
        bypassAuth: true,
    })
    await mailOperations.createMailingListExternalRelation({
        data: { mailingListId: listOneId, mailAddressExternalId: externalId },
        bypassAuth: true,
    })
    await mailOperations.createMailingListExternalRelation({
        data: { mailingListId: listTwoId, mailAddressExternalId: externalId },
        bypassAuth: true,
    })

    const readUser = (id: number) => prisma.user.findUniqueOrThrow({ where: { id }, select: userBasicSelection })

    return {
        aliasA: await prisma.mailAlias.findUniqueOrThrow({ where: { id: aliasAId } }),
        aliasB: await prisma.mailAlias.findUniqueOrThrow({ where: { id: aliasBId } }),
        listOne: await prisma.mailingList.findUniqueOrThrow({ where: { id: listOneId } }),
        listTwo: await prisma.mailingList.findUniqueOrThrow({ where: { id: listTwoId } }),
        group: await prisma.group.findUniqueOrThrow({ where: { id: groupId } }),
        firstUser: await readUser(firstUserId),
        secondUser: await readUser(secondUserId),
        external: await prisma.mailAddressExternal.findUniqueOrThrow({ where: { id: externalId } }),
    }
}

let graph: Awaited<ReturnType<typeof createGraph>>

beforeAll(async () => {
    graph = await createGraph()
})

function viaList(list: MailingList): ViaType {
    return { type: 'mailingList', id: list.id, label: list.name }
}

function viaGroup(group: Group): ViaType {
    return { type: 'group', id: group.id, label: String(group.id) }
}

function traverse(filter: MailListTypes, id: number) {
    return mailOperations.readMailTraversal({ params: { filter, id }, bypassAuth: true })
}

describe('reading the mail traversal', () => {
    test('from an alias on two lists', async () => {
        const { aliasA, listOne, listTwo, group, firstUser, secondUser, external } = graph

        expect(await traverse('alias', aliasA.id)).toStrictEqual({
            alias: [aliasA],
            mailingList: [listOne, listTwo],
            group: [{ ...group, via: [viaList(listOne), viaList(listTwo)] }],
            user: [
                { ...firstUser, via: [viaList(listOne), viaGroup(group)] },
                { ...secondUser, via: [viaList(listTwo), viaGroup(group)] },
            ],
            mailaddressExternal: [{ ...external, via: [viaList(listOne), viaList(listTwo)] }],
        })
    })

    test('from an alias on one list', async () => {
        const { aliasB, listOne, group, firstUser, secondUser, external } = graph

        expect(await traverse('alias', aliasB.id)).toStrictEqual({
            alias: [aliasB],
            mailingList: [listOne],
            group: [{ ...group, via: [viaList(listOne)] }],
            user: [
                { ...firstUser, via: [viaList(listOne), viaGroup(group)] },
                { ...secondUser, via: [viaGroup(group)] },
            ],
            mailaddressExternal: [{ ...external, via: [viaList(listOne)] }],
        })
    })

    test('from a mailing list, where a direct user keeps no via', async () => {
        const { aliasA, aliasB, listOne, group, firstUser, secondUser, external } = graph

        expect(await traverse('mailingList', listOne.id)).toStrictEqual({
            mailingList: [listOne],
            alias: [aliasA, aliasB],
            group: [group],
            user: [firstUser, { ...secondUser, via: [viaGroup(group)] }],
            mailaddressExternal: [external],
        })
    })

    test('from the other mailing list', async () => {
        const { aliasA, listTwo, group, firstUser, secondUser, external } = graph

        expect(await traverse('mailingList', listTwo.id)).toStrictEqual({
            mailingList: [listTwo],
            alias: [aliasA],
            group: [group],
            user: [secondUser, { ...firstUser, via: [viaGroup(group)] }],
            mailaddressExternal: [external],
        })
    })

    test('from an external address', async () => {
        const { aliasA, aliasB, listOne, listTwo, external } = graph

        expect(await traverse('mailaddressExternal', external.id)).toStrictEqual({
            mailaddressExternal: [external],
            mailingList: [listOne, listTwo],
            alias: [
                { ...aliasA, via: [viaList(listOne), viaList(listTwo)] },
                { ...aliasB, via: [viaList(listOne)] },
            ],
            user: [],
            group: [],
        })
    })

    test('from a group', async () => {
        const { aliasA, aliasB, listOne, listTwo, group, firstUser, secondUser } = graph

        expect(await traverse('group', group.id)).toStrictEqual({
            mailaddressExternal: [],
            mailingList: [listOne, listTwo],
            alias: [
                { ...aliasA, via: [viaList(listOne), viaList(listTwo)] },
                { ...aliasB, via: [viaList(listOne)] },
            ],
            user: [firstUser, secondUser],
            group: [group],
        })
    })

    test('from a user, where a direct list keeps no via', async () => {
        const { aliasA, aliasB, listOne, listTwo, group, firstUser } = graph

        expect(await traverse('user', firstUser.id)).toStrictEqual({
            mailaddressExternal: [],
            mailingList: [listOne, { ...listTwo, via: [viaGroup(group)] }],
            alias: [
                { ...aliasA, via: [viaList(listOne), viaList(listTwo)] },
                { ...aliasB, via: [viaList(listOne)] },
            ],
            user: [firstUser],
            group: [group],
        })
    })

    test('from the other user', async () => {
        const { aliasA, aliasB, listOne, listTwo, group, secondUser } = graph

        expect(await traverse('user', secondUser.id)).toStrictEqual({
            mailaddressExternal: [],
            mailingList: [listTwo, { ...listOne, via: [viaGroup(group)] }],
            alias: [
                { ...aliasA, via: [viaList(listTwo), viaList(listOne)] },
                { ...aliasB, via: [viaList(listOne)] },
            ],
            user: [secondUser],
            group: [group],
        })
    })
})
