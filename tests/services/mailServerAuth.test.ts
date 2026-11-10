import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { Session } from '@/auth/session/Session'
import { adminNavDef } from '@/app/(omegaweb)/admin/adminNavDef'
import { careerAdminNavDef } from '@/app/(careers)/career/admin/careerAdminNavDef'
import { aliasMailAddressOperations, aliasOperations } from '@/services/mail/alias/operations'
import { mailingListOperations } from '@/services/mail/list/operations'
import { mailOperations, mailTraversalReadOfType } from '@/services/mail/operations'
import { mailAddressExternalOperations } from '@/services/mail/mailAddressExternal/operations'
import { omegaOrderOperations } from '@/services/omegaOrder/operations'
import { userPrivateSelection } from '@/services/users/constants'
import { COMMITTEE_PERMISSIONS } from '@/seeder/src/permissions'
import { afterEach, describe, expect, test } from '@jest/globals'
import type { Permission } from '@/prisma-generated-pn-types'
import type { SessionMaybeUser } from '@/auth/session/Session'
import type { MembershipFiltered } from '@/services/groups/types'
import type { UserFiltered } from '@/services/users/types'

const sessionWith = (permissions: Permission[]) => Session.fromJsObject({
    memberships: [],
    permissions,
    user: null,
})

/** The rule a refused call answers with, which the forms show. */
const rejectsSaying = (call: Promise<unknown>, rule: string) => expect(call).rejects.toMatchObject({
    errorCode: 'UNAUTHORIZED',
    errors: expect.arrayContaining([expect.objectContaining({ message: expect.stringContaining(rule) })]),
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
    await prisma.mailAddress.deleteMany({ where: { address: { startsWith: 'test-' } } })
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
        // Marking reads the memberships from the database, not off the session.
        await prisma.membership.create({ data: { userId: member.id, ...owners.membership } })
        const markingOwn = { markOwnedByUserId: member.id }
        const ownedAliases = await aliasOperations.readMany({ params: markingOwn, session: asOwner })
        expect(ownedAliases.map(alias => [alias.id, alias.owned])).toStrictEqual([[ownAlias.id, true]])
        const ownedLists = await mailingListOperations.readMany({ params: markingOwn, session: asOwner })
        expect(ownedLists.map(list => [list.id, list.owned])).toStrictEqual([[ownList.id, true]])
        expect(await aliasOperations.visibility.readMatrix({ params: { id: ownAlias.id }, session: asOwner }))
            .toStrictEqual({ requirements: ownerRequirements })
        expect((await mailTraversalReadOfType.alias({ params: { id: ownAlias.id, ...markingOwn }, session: asOwner }))
            .alias.map(alias => [alias.id, alias.owned])).toStrictEqual([[ownAlias.id, true]])
        // A read marks what the reader owns, never what someone else does.
        const other = await createUser('other-member')
        await rejectsSaying(
            aliasOperations.readMany({ params: { markOwnedByUserId: other.id }, session: asOwner }),
            'det du selv eier',
        )
        await rejectsSaying(
            mailTraversalReadOfType.alias({ params: { id: ownAlias.id, markOwnedByUserId: other.id }, session: asOwner }),
            'det du selv eier',
        )

        const asOther = memberSession(member, [others.membership])
        await rejectsSaying(aliasOperations.readMany({ params: {}, session: asOther }), 'eierne av et alias')
        await rejectsSaying(mailingListOperations.readMany({ params: {}, session: asOther }), 'eierne av en e-postliste')
        expect(await mailOperations.readMailOptions({ session: asOther }))
            .toStrictEqual({ alias: [], mailingList: [], mailaddressExternal: [] })
        await expect(aliasOperations.visibility.readMatrix({ params: { id: ownAlias.id }, session: asOther }))
            .rejects.toThrow(Smorekopp)
        await expect(mailTraversalReadOfType.mailingList({
            params: { id: ownList.id },
            session: asOther,
        })).rejects.toThrow(Smorekopp)

        const asUse = sessionWith(['MAILSERVER_USE'])
        // Reading everything is not owning it, and with no reader asked for nothing is marked.
        const allAliases = await aliasOperations.readMany({ params: {}, session: asUse })
        expect(allAliases.length).toBeGreaterThanOrEqual(2)
        expect(allAliases.every(alias => !alias.owned)).toBe(true)
        expect(await aliasOperations.visibility.readMatrix({ params: { id: ownAlias.id }, session: asUse }))
            .toStrictEqual({ requirements: ownerRequirements })
    })

    test('the external addresses are listed by any list\'s owners and the mail permissions, by no one else', async () => {
        const external = await mailAddressExternalOperations.create({
            data: { address: 'test-pool@example.com', description: '' },
            bypassAuth: true,
        })
        const owners = await createGroup('pool-owners')
        await mailingListOperations.create({
            data: {
                name: 'test-pool',
                description: '',
                ownerRequirements: [{ conditions: [{ type: 'ACTIVE' as const, groupId: owners.id }] }],
            },
            bypassAuth: true,
        })
        const member = await createUser('pool-member')
        const asCreator = Session.fromJsObject({ memberships: [], permissions: ['MAIL_LIST_CREATE'], user: member })
        expect((await mailAddressExternalOperations.readMany({ session: asCreator })).map(address => address.id))
            .toContain(external.id)
        expect((await mailOperations.readMailOptions({ session: asCreator })).mailaddressExternal.map(address => address.id))
            .toContain(external.id)

        const asListOwner = memberSession(member, [owners.membership])
        expect((await mailAddressExternalOperations.readMany({ session: asListOwner })).map(address => address.id))
            .toContain(external.id)
        expect((await mailTraversalReadOfType.mailaddressExternal({ params: { id: external.id }, session: asListOwner }))
            .mailaddressExternal.map(address => address.id)).toStrictEqual([external.id])

        const asMember = memberSession(member, [])
        await rejectsSaying(mailAddressExternalOperations.readMany({ session: asMember }), 'eierne av en e-postliste')
        expect((await mailOperations.readMailOptions({ session: asMember })).mailaddressExternal).toStrictEqual([])
    })

    test('the admin navs offer the mail server to the owners of a list, and to no other plain member', async () => {
        const owners = await createGroup('nav-owners')
        const others = await createGroup('nav-others')
        const member = await createUser('nav-member')
        await mailingListOperations.create({
            data: {
                name: 'test-nav',
                description: '',
                ownerRequirements: [{ conditions: [{ type: 'ACTIVE' as const, groupId: owners.id }] }],
            },
            bypassAuth: true,
        })

        const keysOf = async (session: SessionMaybeUser) =>
            (await adminNavDef.visible(session)).flatMap(group => group.links.map(link => link.key))
        expect(await keysOf(memberSession(member, [owners.membership]))).toContain('mail/mailingList')
        expect(await keysOf(memberSession(member, [others.membership]))).not.toContain('mail/mailingList')
        expect((await careerAdminNavDef.visible(memberSession(member, [owners.membership]))).map(link => link.key))
            .toContain('mail')
        await expect(careerAdminNavDef.authorizeAny(memberSession(member, [others.membership]))).rejects.toThrow(Smorekopp)
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

describe('wiring the mail server as an owner', () => {
    const activeIn = (groupId: number) => [{ conditions: [{ type: 'ACTIVE' as const, groupId }] }]

    test('a connection needs authority over both ends, cutting it over either', async () => {
        const owners = await createGroup('wire-owners')
        const led = await createGroup('wire-led')
        const member = await createUser('wire-member')
        const other = await createUser('wire-other')
        const ownAlias = await aliasOperations.create({
            data: {
                localPart: 'test-wire', domain: 'omega.ntnu.no', description: '', ownerRequirements: activeIn(owners.id),
            },
            bypassAuth: true,
        })
        const ownList = await mailingListOperations.create({
            data: { name: 'test-wire', description: '', ownerRequirements: activeIn(owners.id) },
            bypassAuth: true,
        })
        const { alias: foreignAlias, list: foreignList } = await createAliasAndList('wire-foreign')
        const external = await mailAddressExternalOperations.create({
            data: { address: 'test-wire@example.com', description: '' },
            bypassAuth: true,
        })
        const asOwner = memberSession(member, [owners.membership, { ...led.membership, admin: true }])

        await mailOperations.createAliasMailingListRelation({
            data: { mailAliasId: ownAlias.id, mailingListId: ownList.id }, session: asOwner,
        })
        await rejectsSaying(mailOperations.createAliasMailingListRelation({
            data: { mailAliasId: ownAlias.id, mailingListId: foreignList.id }, session: asOwner,
        }), 'Du kan bare koble til en e-postliste du eier')
        await rejectsSaying(mailOperations.createAliasMailingListRelation({
            data: { mailAliasId: foreignAlias.id, mailingListId: ownList.id }, session: asOwner,
        }), 'Du kan bare koble til et alias du eier')

        await mailOperations.createMailingListGroupRelation({
            data: { mailingListId: ownList.id, groupId: led.id }, session: asOwner,
        })
        await rejectsSaying(mailOperations.createMailingListGroupRelation({
            data: { mailingListId: ownList.id, groupId: owners.id }, session: asOwner,
        }), 'gruppeleder')
        await mailOperations.createMailingListUserRelation({
            data: { mailingListId: ownList.id, userId: member.id }, session: asOwner,
        })
        await rejectsSaying(mailOperations.createMailingListUserRelation({
            data: { mailingListId: ownList.id, userId: other.id }, session: asOwner,
        }), 'Du kan bare sette deg selv på listen')
        await mailOperations.createMailingListExternalRelation({
            data: { mailingListId: ownList.id, mailAddressExternalId: external.id }, session: asOwner,
        })

        // A group's admin takes their group off a list they do not own; a member of neither cannot.
        await mailOperations.createMailingListGroupRelation({
            data: { mailingListId: foreignList.id, groupId: led.id }, bypassAuth: true,
        })
        await expect(mailOperations.destroyMailingListGroupRelation({
            data: { mailingListId: foreignList.id, groupId: led.id }, session: memberSession(other, []),
        })).rejects.toThrow(Smorekopp)
        await mailOperations.destroyMailingListGroupRelation({
            data: { mailingListId: foreignList.id, groupId: led.id }, session: asOwner,
        })
        expect(await prisma.mailingListGroup.count({ where: { mailingListId: foreignList.id } })).toBe(0)
    })

    test('a creator with the permission must be among the owners, and owners change what they own', async () => {
        const owners = await createGroup('create-owners')
        const others = await createGroup('create-others')
        const member = await createUser('create-member')
        const asCreator = Session.fromJsObject({
            memberships: [owners.membership], permissions: ['MAIL_LIST_CREATE'], user: member,
        })

        await rejectsSaying(mailingListOperations.create({
            data: { name: 'test-create-unowned', description: '' }, session: asCreator,
        }), 'Du må selv være blant eierne')
        await rejectsSaying(mailingListOperations.create({
            data: { name: 'test-create-others', description: '', ownerRequirements: activeIn(others.id) },
            session: asCreator,
        }), 'Du må selv være blant eierne')
        const list = await mailingListOperations.create({
            data: { name: 'test-create-own', description: '', ownerRequirements: activeIn(owners.id) }, session: asCreator,
        })

        await mailingListOperations.update({
            params: { id: list.id }, data: { name: 'test-create-own', description: 'Vår' }, session: asCreator,
        })
        await rejectsSaying(mailingListOperations.update({
            params: { id: list.id },
            data: { name: 'test-create-own', description: 'Deres' },
            session: memberSession(member, [others.membership]),
        }), 'Bare eierne av e-postlisten kan endre den')
    })

    test('the address of an alias is changed by an owner who may create aliases, the description by any owner', async () => {
        const owners = await createGroup('rename-owners')
        const member = await createUser('rename-member')
        const alias = await aliasOperations.create({
            data: {
                localPart: 'test-rename', domain: 'omega.ntnu.no', description: '', ownerRequirements: activeIn(owners.id),
            },
            bypassAuth: true,
        })
        const mailAddress = await prisma.mailAddress.findUniqueOrThrow({ where: { address: alias.address } })
        const rename = (session: SessionMaybeUser) => aliasMailAddressOperations.update({
            implementationParams: { id: alias.id },
            params: { mailAddressId: mailAddress.id },
            data: { localPart: 'test-renamed', domain: 'omega.ntnu.no' },
            session,
        })
        const asOwner = memberSession(member, [owners.membership])
        const asCreatingOwner = Session.fromJsObject({
            memberships: [owners.membership], permissions: ['MAIL_ALIAS_CREATE'], user: member,
        })
        const asCreatingOutsider = Session.fromJsObject({
            memberships: [], permissions: ['MAIL_ALIAS_CREATE'], user: member,
        })

        await aliasOperations.updateDescription({
            params: { id: alias.id }, data: { description: 'Vårt' }, session: asOwner,
        })
        await rejectsSaying(rename(asOwner), 'Bare eiere som kan opprette aliaser kan endre adressen')
        await rejectsSaying(rename(asCreatingOutsider), 'Bare eiere som kan opprette aliaser kan endre adressen')

        const updated = await rename(asCreatingOwner)
        expect(updated.address).toBe('test-renamed@omega.ntnu.no')
        expect((await prisma.mailAlias.findUniqueOrThrow({ where: { id: alias.id } })).address).toBe(updated.address)
        await rename(sessionWith(['MAILSERVER_ADMIN']))
    })

    test('the aliases a user receives mail on are read by that user alone', async () => {
        const reader = await createUser('received-reader')
        const other = await createUser('received-other')
        const group = await createGroup('received-group')
        await prisma.membership.createMany({ data: [
            { userId: reader.id, groupId: group.id, admin: false, active: true, order: group.order },
            { userId: other.id, groupId: group.id, admin: false, active: false, order: group.order },
        ] })
        const aliasOf = async (localPart: string) => {
            const alias = await aliasOperations.create({
                data: { localPart, domain: 'omega.ntnu.no', description: '' }, bypassAuth: true,
            })
            const list = await mailingListOperations.create({
                data: { name: `${localPart}-list`, description: '' }, bypassAuth: true,
            })
            await mailOperations.createAliasMailingListRelation({
                data: { mailAliasId: alias.id, mailingListId: list.id }, bypassAuth: true,
            })
            return { alias, list }
        }
        const direct = await aliasOf('test-received-direct')
        await mailOperations.createMailingListUserRelation({
            data: { userId: reader.id, mailingListId: direct.list.id }, bypassAuth: true,
        })
        const viaGroup = await aliasOf('test-received-group')
        await mailOperations.createMailingListGroupRelation({
            data: { groupId: group.id, mailingListId: viaGroup.list.id }, bypassAuth: true,
        })
        const theirs = await aliasOf('test-received-theirs')
        await mailOperations.createMailingListUserRelation({
            data: { userId: other.id, mailingListId: theirs.list.id }, bypassAuth: true,
        })

        const received = await aliasOperations.readReceived({
            params: { userId: reader.id }, session: memberSession(reader, []),
        })
        expect(received.map(alias => alias.address)).toEqual([direct.alias.address, viaGroup.alias.address])
        // The other user's membership is inactive, so the group's alias is not theirs.
        const theirReceived = await aliasOperations.readReceived({
            params: { userId: other.id }, session: memberSession(other, []),
        })
        expect(theirReceived.map(alias => alias.address)).toEqual([theirs.alias.address])

        await rejectsSaying(aliasOperations.readReceived({
            params: { userId: reader.id }, session: memberSession(other, []),
        }), 'Bare du selv ser aliasene du mottar e-post på')
        // Not even a mail server admin: the mail is the user's.
        await rejectsSaying(aliasOperations.readReceived({
            params: { userId: reader.id },
            session: Session.fromJsObject({ memberships: [], permissions: ['MAILSERVER_ADMIN'], user: other }),
        }), 'Bare du selv ser aliasene du mottar e-post på')
    })
})
