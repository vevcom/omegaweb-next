import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { Session } from '@/auth/session/Session'
import { aliasOperations } from '@/services/mail/alias/operations'
import { mailingListOperations } from '@/services/mail/list/operations'
import { mailOperations, mailTraversalReadOfType } from '@/services/mail/operations'
import { mailAddressExternalOperations } from '@/services/mail/mailAddressExternal/operations'
import { omegaOrderOperations } from '@/services/omegaOrder/operations'
import { userPrivateSelection } from '@/services/users/constants'
import { COMMITTEE_PERMISSIONS } from '@/seeder/src/permissions'
import { afterEach, describe, expect, test } from '@jest/globals'
import type { Permission } from '@/prisma-generated-pn-types'
import type { MembershipFiltered } from '@/services/groups/types'
import type { UserFiltered } from '@/services/users/types'

const sessionWith = (permissions: Permission[]) => Session.fromJsObject({
    memberships: [],
    permissions,
    user: null,
})

/** A logged in user with no permissions, a member of the groups given. */
const memberSession = (user: UserFiltered, memberships: MembershipFiltered[]) => Session.fromJsObject({
    memberships,
    permissions: [],
    user,
})

async function createUser(name: string) {
    return prisma.user.create({
        data: {
            username: `test-${name}`,
            email: `test-${name}@test.test`,
            bioParagraph: { create: {} },
            ledgerAccount: { create: { type: 'USER' } },
        },
        select: userPrivateSelection,
    })
}

async function createGroup(name: string) {
    const { order } = await omegaOrderOperations.readCurrent({ bypassAuth: true })
    const group = await prisma.group.create({
        data: {
            groupType: 'MANUAL_GROUP',
            order,
            manualGroup: { create: { name: `test-${name}`, shortName: `test-${name}` } },
        },
    })
    return { ...group, membership: { groupId: group.id, order, active: true, admin: false } }
}

async function createAliasAndList(name: string) {
    const alias = await aliasOperations.create({
        data: { localPart: `test-${name}`, domain: 'omega.ntnu.no', description: '' },
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
    await prisma.membership.deleteMany({ where: { user: { username: { startsWith: 'test-' } } } })
    await prisma.user.deleteMany({ where: { username: { startsWith: 'test-' } } })
    await prisma.mailAlias.deleteMany({ where: { address: { startsWith: 'test-' } } })
    await prisma.mailingList.deleteMany({ where: { name: { startsWith: 'test-' } } })
    await prisma.mailAddressExternal.deleteMany({ where: { address: { startsWith: 'test-' } } })
    await prisma.manualGroup.deleteMany({ where: { shortName: { startsWith: 'test-' } } })
    await prisma.group.deleteMany({ where: { groupType: 'MANUAL_GROUP', manualGroup: null } })
})

describe('reading the mail server as an owner', () => {
    test('owners read what they own and nothing else; MAILSERVER_USE reads everything', async () => {
        const owners = await createGroup('owners')
        const others = await createGroup('others')
        const member = await createUser('owner-member')
        const ownerRequirements = [{ conditions: [{ type: 'ACTIVE' as const, groupId: owners.id }] }]
        const ownAlias = await aliasOperations.create({
            data: { localPart: 'test-own', domain: 'omega.ntnu.no', description: '', ownerRequirements },
            bypassAuth: true,
        })
        const ownList = await mailingListOperations.create({
            data: { name: 'test-own', description: '', ownerRequirements },
            bypassAuth: true,
        })
        await createAliasAndList('not-own')

        const asOwner = memberSession(member, [owners.membership])
        expect((await aliasOperations.readMany({ session: asOwner })).map(alias => alias.id))
            .toStrictEqual([ownAlias.id])
        expect((await mailingListOperations.readMany({ session: asOwner })).map(list => list.id))
            .toStrictEqual([ownList.id])
        expect(await aliasOperations.visibility.readMatrix({ params: { id: ownAlias.id }, session: asOwner }))
            .toStrictEqual({ requirements: ownerRequirements })
        expect((await mailTraversalReadOfType.alias({ params: { id: ownAlias.id }, session: asOwner }))
            .alias.map(alias => alias.id)).toStrictEqual([ownAlias.id])

        const asOther = memberSession(member, [others.membership])
        expect(await aliasOperations.readMany({ session: asOther })).toStrictEqual([])
        expect(await mailingListOperations.readMany({ session: asOther })).toStrictEqual([])
        await expect(aliasOperations.visibility.readMatrix({ params: { id: ownAlias.id }, session: asOther }))
            .rejects.toThrow(Smorekopp)
        await expect(mailTraversalReadOfType.mailingList({
            params: { id: ownList.id },
            session: asOther,
        })).rejects.toThrow(Smorekopp)

        const asUse = sessionWith(['MAILSERVER_USE'])
        expect((await aliasOperations.readMany({ session: asUse })).length).toBeGreaterThanOrEqual(2)
        expect(await aliasOperations.visibility.readMatrix({ params: { id: ownAlias.id }, session: asUse }))
            .toStrictEqual({ requirements: ownerRequirements })
    })

    test('the external addresses are listed by those the admin is open to, and offered to no one else', async () => {
        const external = await mailAddressExternalOperations.create({
            data: { address: 'test-pool@example.com', description: '' },
            bypassAuth: true,
        })
        const member = await createUser('pool-member')
        const asCreator = Session.fromJsObject({ memberships: [], permissions: ['MAIL_LIST_CREATE'], user: member })
        expect((await mailAddressExternalOperations.readMany({ session: asCreator })).map(address => address.id))
            .toContain(external.id)
        expect((await mailOperations.readMailOptions({ session: asCreator })).mailaddressExternal.map(address => address.id))
            .toContain(external.id)

        const asMember = memberSession(member, [])
        await expect(mailAddressExternalOperations.readMany({ session: asMember })).rejects.toThrow(Smorekopp)
        expect((await mailOperations.readMailOptions({ session: asMember })).mailaddressExternal).toStrictEqual([])
    })

    test('a group\'s members and a user themselves read their own traversal', async () => {
        const group = await createGroup('traversal')
        const member = await createUser('traversal-member')
        const stranger = await createUser('traversal-stranger')
        await prisma.membership.create({ data: { ...group.membership, userId: member.id } })

        const asMember = memberSession(member, [group.membership])
        expect((await mailTraversalReadOfType.group({ params: { id: group.id }, session: asMember }))
            .group.map(flowGroup => flowGroup.id)).toStrictEqual([group.id])
        expect((await mailTraversalReadOfType.user({ params: { id: member.id }, session: asMember }))
            .user.map(user => user.id)).toStrictEqual([member.id])

        const asStranger = memberSession(stranger, [])
        await expect(mailTraversalReadOfType.group({ params: { id: group.id }, session: asStranger }))
            .rejects.toThrow(Smorekopp)
        await expect(mailTraversalReadOfType.user({ params: { id: member.id }, session: asStranger }))
            .rejects.toThrow(Smorekopp)
    })
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
