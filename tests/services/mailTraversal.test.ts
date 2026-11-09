import { prisma } from '@/prisma-pn-client-instance'
import { omegaOrderOperations } from '@/services/omegaOrder/operations'
import { aliasOperations } from '@/services/mail/alias/operations'
import { mailingListOperations } from '@/services/mail/list/operations'
import { mailAddressExternalOperations } from '@/services/mail/mailAddressExternal/operations'
import { mailOperations, mailTraversalReadOfType } from '@/services/mail/operations'
import { userBasicSelection } from '@/services/users/constants'
import { beforeAll, describe, expect, test } from '@jest/globals'
import type { MailingList } from '@/prisma-generated-pn-types'
import type { MailFlowGroup, MailFlowPaths, MailListTypes, ViaType } from '@/services/mail/types'

/**
 * Builds the graph every test reads from. Every node is reachable along more than one path,
 * so both the ordering of the results and the merging of `via` entries are exercised.
 *
 *   aliasA  -> listOne, listTwo
 *   aliasB  -> listOne
 *   listOne -> group, firstUser (directly), external
 *   listTwo -> group, secondUser (directly), external
 *   group   -> firstUser, secondUser (memberships), and an archived user mail never reaches
 *
 * listOne is owned by the group's members, listTwo and the aliases by no one.
 *
 * Rows are created in id order so the expected ordering does not depend on how the database scans them.
 * The records are read back afterwards so they are compared in the exact shape the traversal returns
 * when no reader is asked for, which marks nothing as owned or administrated.
 */
async function createGraph() {
    const { order } = await omegaOrderOperations.readCurrent({ bypassAuth: true })
    const groupId = (await prisma.group.create({
        data: {
            groupType: 'MANUAL_GROUP',
            order,
            manualGroup: { create: { name: 'Traversal Group', shortName: 'traversal-group' } },
        },
    })).id
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
    const archivedUserId = (await prisma.user.create({
        data: {
            username: 'traversal-archived',
            email: 'traversal-archived@test.test',
            archived: true,
            bioParagraph: { create: {} },
            ledgerAccount: { create: { type: 'USER' } },
        },
    })).id
    await prisma.membership.create({ data: { userId: firstUserId, groupId, admin: false, active: true, order } })
    await prisma.membership.create({ data: { userId: secondUserId, groupId, admin: false, active: true, order } })
    await prisma.membership.create({ data: { userId: archivedUserId, groupId, admin: false, active: true, order } })

    const aliasAId = (await aliasOperations.create({
        data: { localPart: 'traversal-a', domain: 'omega.ntnu.no', description: '' },
        bypassAuth: true,
    })).id
    const aliasBId = (await aliasOperations.create({
        data: { localPart: 'traversal-b', domain: 'omega.ntnu.no', description: '' },
        bypassAuth: true,
    })).id
    const listOneId = (await mailingListOperations.create({
        data: {
            name: 'traversal-list-one',
            description: '',
            ownerRequirements: [{ conditions: [{ type: 'ACTIVE' as const, groupId }] }],
        },
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
        order,
        aliasA: { ...await prisma.mailAlias.findUniqueOrThrow({ where: { id: aliasAId } }), owned: false },
        aliasB: { ...await prisma.mailAlias.findUniqueOrThrow({ where: { id: aliasBId } }), owned: false },
        listOne: { ...await prisma.mailingList.findUniqueOrThrow({ where: { id: listOneId } }), owned: false },
        listTwo: { ...await prisma.mailingList.findUniqueOrThrow({ where: { id: listTwoId } }), owned: false },
        group: {
            ...await prisma.group.findUniqueOrThrow({ where: { id: groupId } }),
            name: 'Traversal Group',
            admin: false,
        },
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

function viaGroup(group: MailFlowGroup): ViaType {
    return { type: 'group', id: group.id, label: group.name }
}

/** A node connected straight to the one in focus. */
function direct<Node extends object>(node: Node): Node & MailFlowPaths {
    return { ...node, direct: true, via: [] }
}

/** A node only reached through others. */
function indirect<Node extends object>(node: Node, ...via: ViaType[]): Node & MailFlowPaths {
    return { ...node, direct: false, via }
}

/** A node connected straight to the one in focus and reached through others too. */
function both<Node extends object>(node: Node, ...via: ViaType[]): Node & MailFlowPaths {
    return { ...node, direct: true, via }
}

function traverse(filter: MailListTypes, id: number, markOwnedByUserId?: number) {
    return mailTraversalReadOfType[filter]({ params: { id, markOwnedByUserId }, bypassAuth: true })
}

describe('reading the mail traversal', () => {
    test('from an alias on two lists', async () => {
        const { aliasA, listOne, listTwo, group, firstUser, secondUser, external } = graph

        expect(await traverse('alias', aliasA.id)).toStrictEqual({
            alias: [direct(aliasA)],
            mailingList: [direct(listOne), direct(listTwo)],
            group: [indirect(group, viaList(listOne), viaList(listTwo))],
            user: [
                indirect(firstUser, viaList(listOne), viaGroup(group)),
                indirect(secondUser, viaList(listTwo), viaGroup(group)),
            ],
            mailaddressExternal: [indirect(external, viaList(listOne), viaList(listTwo))],
        })
    })

    test('from an alias on one list', async () => {
        const { aliasB, listOne, group, firstUser, secondUser, external } = graph

        expect(await traverse('alias', aliasB.id)).toStrictEqual({
            alias: [direct(aliasB)],
            mailingList: [direct(listOne)],
            group: [indirect(group, viaList(listOne))],
            user: [
                indirect(firstUser, viaList(listOne), viaGroup(group)),
                indirect(secondUser, viaGroup(group)),
            ],
            mailaddressExternal: [indirect(external, viaList(listOne))],
        })
    })

    test('from a mailing list, where a direct user in a group on it is reached both ways', async () => {
        const { aliasA, aliasB, listOne, group, firstUser, secondUser, external } = graph

        expect(await traverse('mailingList', listOne.id)).toStrictEqual({
            mailingList: [direct(listOne)],
            alias: [direct(aliasA), direct(aliasB)],
            group: [direct(group)],
            user: [both(firstUser, viaGroup(group)), indirect(secondUser, viaGroup(group))],
            mailaddressExternal: [direct(external)],
        })
    })

    test('from the other mailing list', async () => {
        const { aliasA, listTwo, group, firstUser, secondUser, external } = graph

        expect(await traverse('mailingList', listTwo.id)).toStrictEqual({
            mailingList: [direct(listTwo)],
            alias: [direct(aliasA)],
            group: [direct(group)],
            user: [both(secondUser, viaGroup(group)), indirect(firstUser, viaGroup(group))],
            mailaddressExternal: [direct(external)],
        })
    })

    test('from an external address', async () => {
        const { aliasA, aliasB, listOne, listTwo, external } = graph

        expect(await traverse('mailaddressExternal', external.id)).toStrictEqual({
            mailaddressExternal: [direct(external)],
            mailingList: [direct(listOne), direct(listTwo)],
            alias: [
                indirect(aliasA, viaList(listOne), viaList(listTwo)),
                indirect(aliasB, viaList(listOne)),
            ],
            user: [],
            group: [],
        })
    })

    test('from a group', async () => {
        const { aliasA, aliasB, listOne, listTwo, group, firstUser, secondUser } = graph

        expect(await traverse('group', group.id)).toStrictEqual({
            mailaddressExternal: [],
            mailingList: [direct(listOne), direct(listTwo)],
            alias: [
                indirect(aliasA, viaList(listOne), viaList(listTwo)),
                indirect(aliasB, viaList(listOne)),
            ],
            user: [direct(firstUser), direct(secondUser)],
            group: [direct(group)],
        })
    })

    test('from a user, where a direct list their group is on is reached both ways', async () => {
        const { aliasA, aliasB, listOne, listTwo, group, firstUser } = graph

        expect(await traverse('user', firstUser.id)).toStrictEqual({
            mailaddressExternal: [],
            mailingList: [both(listOne, viaGroup(group)), indirect(listTwo, viaGroup(group))],
            alias: [
                indirect(aliasA, viaList(listOne), viaList(listTwo)),
                indirect(aliasB, viaList(listOne)),
            ],
            user: [direct(firstUser)],
            group: [direct(group)],
        })
    })

    test('from the other user', async () => {
        const { aliasA, aliasB, listOne, listTwo, group, secondUser } = graph

        expect(await traverse('user', secondUser.id)).toStrictEqual({
            mailaddressExternal: [],
            mailingList: [both(listTwo, viaGroup(group)), indirect(listOne, viaGroup(group))],
            alias: [
                indirect(aliasA, viaList(listTwo), viaList(listOne)),
                indirect(aliasB, viaList(listOne)),
            ],
            user: [direct(secondUser)],
            group: [direct(group)],
        })
    })

    test('what the reader asked for owns and administrates is marked by their memberships', async () => {
        const { aliasA, listOne, listTwo, group, firstUser, secondUser } = graph
        await prisma.membership.update({
            where: { userId_groupId_order: { userId: firstUser.id, groupId: group.id, order: graph.order } },
            data: { admin: true },
        })

        expect(await traverse('alias', aliasA.id, firstUser.id)).toMatchObject({
            alias: [{ owned: false }],
            mailingList: [{ id: listOne.id, owned: true }, { id: listTwo.id, owned: false }],
            group: [{ admin: true }],
        })
        expect(await traverse('alias', aliasA.id, secondUser.id)).toMatchObject({
            alias: [{ owned: false }],
            mailingList: [{ id: listOne.id, owned: true }, { id: listTwo.id, owned: false }],
            group: [{ admin: false }],
        })
    })
})
