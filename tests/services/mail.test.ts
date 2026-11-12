import { testDomainConfig } from 'tests/testDomains'
import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { omegaOrderOperations } from '@/services/omegaOrder/operations'
import { aliasOperations } from '@/services/mail/alias/operations'
import { mailingListOperations } from '@/services/mail/list/operations'
import { mailAddressExternalOperations } from '@/services/mail/mailAddressExternal/operations'
import { mailOperations, mailTraversalReadOfType } from '@/services/mail/operations'
import { DomainConfig } from '@/lib/sites/domainConfig'
import { DomainContext } from '@/lib/sites/context'
import { afterEach, describe, expect, test } from '@jest/globals'

// NOTE: This test doesn't check auth, since I think this should be testing in a separate file -Theodor

const testGroupIds: number[] = []

afterEach(async () => {
    await prisma.mailingListUser.deleteMany()
    await prisma.mailingListGroup.deleteMany()
    await prisma.mailAliasMailingList.deleteMany()
    await prisma.mailingListMailAddressExternal.deleteMany()
    await prisma.membership.deleteMany({ where: { user: { username: { startsWith: 'test-' } } } })
    await prisma.user.deleteMany({ where: { username: { startsWith: 'test-' } } })
    await prisma.manualGroup.deleteMany({ where: { groupId: { in: testGroupIds } } })
    await prisma.group.deleteMany({ where: { id: { in: testGroupIds } } })
    testGroupIds.length = 0
    // Only delete aliases/lists/externals created by tests (not seeded data)
    await prisma.mailAlias.deleteMany({ where: { address: { startsWith: 'test-' } } })
    await prisma.mailAddress.deleteMany({ where: { address: { startsWith: 'test-' } } })
    await prisma.mailingList.deleteMany({ where: { name: { startsWith: 'test-' } } })
    await prisma.mailAddressExternal.deleteMany({ where: { address: { endsWith: '@gmail.com' } } })
    await prisma.mailAddressExternal.deleteMany({ where: { address: { startsWith: 'test-' } } })
})

// ─── Owners ───────────────────────────────────────────────────────────────────

describe('the owners of aliases and mailing lists', () => {
    test('an alias created without owners gets a visibility no one passes', async () => {
        const alias = await aliasOperations.create({
            data: { localPart: 'test-unowned', domain: 'omega.ntnu.no', description: '' },
            bypassAuth: true,
        })
        expect(await aliasOperations.visibility.readMatrix({ params: { id: alias.id }, bypassAuth: true })).toStrictEqual({
            requirements: [{ conditions: [] }],
        })
    })

    test('a mailing list is created with the owners given, which can be changed but not emptied', async () => {
        const { order } = await omegaOrderOperations.readCurrent({ bypassAuth: true })
        const group = await prisma.group.create({
            data: {
                groupType: 'MANUAL_GROUP',
                order,
                manualGroup: { create: { name: 'mail-owners', shortName: 'mail-owners' } },
            },
        })
        testGroupIds.push(group.id)
        const owners = (groupId: number) => ({ requirements: [{ conditions: [{ type: 'ACTIVE' as const, groupId }] }] })

        const list = await mailingListOperations.create({
            data: { name: 'test-owned', description: '', ownerRequirements: owners(group.id).requirements },
            bypassAuth: true,
        })
        const readOwners = () => mailingListOperations.visibility.readMatrix({ params: { id: list.id }, bypassAuth: true })
        expect(await readOwners()).toStrictEqual(owners(group.id))

        const otherGroup = await prisma.group.create({
            data: {
                groupType: 'MANUAL_GROUP',
                order,
                manualGroup: { create: { name: 'mail-owners-other', shortName: 'mail-owners-other' } },
            },
        })
        testGroupIds.push(otherGroup.id)
        await mailingListOperations.visibility.update({
            implementationParams: { id: list.id },
            params: { visibilityId: list.ownerVisibilityId },
            data: owners(otherGroup.id),
            bypassAuth: true,
        })
        expect(await readOwners()).toStrictEqual(owners(otherGroup.id))

        await expect(mailingListOperations.visibility.update({
            implementationParams: { id: list.id },
            params: { visibilityId: list.ownerVisibilityId },
            data: { requirements: [] },
            bypassAuth: true,
        })).rejects.toThrow()
        expect(await readOwners()).toStrictEqual(owners(otherGroup.id))
    })

    test('destroying a mailing list destroys its visibility', async () => {
        const list = await mailingListOperations.create({
            data: { name: 'test-destroy-owners', description: '' },
            bypassAuth: true,
        })
        await mailingListOperations.destroy({ params: { id: list.id }, bypassAuth: true })
        expect(await prisma.visibility.findUnique({ where: { id: list.ownerVisibilityId } })).toBeNull()
    })
})

// ─── Alias Domain Validation ──────────────────────────────────────────────────

describe('alias address validation', () => {
    test('valid domain is accepted', async () => {
        const alias = await aliasOperations.create({
            data: { localPart: 'test-valid', domain: 'omega.ntnu.no', description: '' },
            bypassAuth: true,
        })
        expect(alias.address).toBe('test-valid@omega.ntnu.no')
    })

    test('a local part with other characters than an address allows is rejected', async () => {
        await expect(aliasOperations.create({
            data: { localPart: 'test valid', domain: 'omega.ntnu.no', description: '' },
            bypassAuth: true,
        })).rejects.toThrow()
    })

    test('invalid domain is rejected', async () => {
        await expect(aliasOperations.create({
            data: { localPart: 'test', domain: 'invalid-domain.com', description: '' },
            bypassAuth: true,
        })).rejects.toThrow()
        expect(await prisma.mailAlias.count({ where: { address: { endsWith: '@invalid-domain.com' } } })).toBe(0)
    })
})

// ─── The Domains Of The Sites ─────────────────────────────────────────────────

describe('the domains of the sites are mail domains', () => {
    const withSites = () => DomainContext.configure(DomainConfig.parse({
        'omega.ntnu.no': { site: 'OMEGAWEB', main: true },
        'contactor.no': { site: 'CAREERS', main: true },
    }))
    afterEach(() => DomainContext.configure(testDomainConfig))

    test('an alias may be on a site\'s domain, and is stored in lowercase as the mail server looks it up', async () => {
        withSites()
        const alias = await aliasOperations.create({
            data: { localPart: 'Test-Post', domain: 'Contactor.no', description: '' },
            bypassAuth: true,
        })
        expect(alias.address).toBe('test-post@contactor.no')
    })

    test('the same address is refused once the domain is no longer one of the sites\'', async () => {
        await expect(aliasOperations.create({
            data: { localPart: 'test-post', domain: 'contactor.no', description: '' },
            bypassAuth: true,
        })).rejects.toThrow()
    })

    test('an external address may not be on a site\'s domain', async () => {
        withSites()
        await expect(mailAddressExternalOperations.create({
            data: { address: 'someone@contactor.no', description: '' },
            bypassAuth: true,
        })).rejects.toThrow()
    })
})

// ─── External Address Validation ─────────────────────────────────────────────

describe('external mail address validation', () => {
    test('valid external address is accepted', async () => {
        const ext = await mailAddressExternalOperations.create({
            data: { address: 'contact@gmail.com', description: '' },
            bypassAuth: true,
        })
        expect(ext.address).toBe('contact@gmail.com')
    })

    test('internal domain is rejected', async () => {
        await expect(mailAddressExternalOperations.create({
            data: { address: 'someone@omega.ntnu.no', description: '' },
            bypassAuth: true,
        })).rejects.toThrow()
    })

    test('a student address without a user is accepted', async () => {
        const ext = await mailAddressExternalOperations.create({
            data: { address: 'test-student@stud.ntnu.no', description: '' },
            bypassAuth: true,
        })
        expect(ext.address).toBe('test-student@stud.ntnu.no')
    })

    test('the email of a user is rejected, whatever its case', async () => {
        const user = await prisma.user.create({
            data: {
                username: 'test-ext-user',
                email: 'test-ext-user@gmail.com',
                bioParagraph: { create: {} },
                ledgerAccount: { create: { type: 'USER' } },
            },
        })
        await expect(mailAddressExternalOperations.create({
            data: { address: 'Test-Ext-User@gmail.com', description: '' },
            bypassAuth: true,
        })).rejects.toThrow(new Smorekopp('BAD PARAMETERS'))

        const ext = await mailAddressExternalOperations.create({
            data: { address: 'test-other@gmail.com', description: '' },
            bypassAuth: true,
        })
        await expect(mailAddressExternalOperations.update({
            params: { id: ext.id },
            data: { address: user.email, description: '' },
            bypassAuth: true,
        })).rejects.toThrow(new Smorekopp('BAD PARAMETERS'))
    })
})

// ─── Alias Destroy Guard ──────────────────────────────────────────────────────

describe('alias destroy guard', () => {
    test('cannot destroy alias connected to a notification channel', async () => {
        // The seeder connects hs@omega.ntnu.no to a notification channel
        const alias = await prisma.mailAlias.findUniqueOrThrow({ where: { address: 'hs@omega.ntnu.no' } })

        await expect(aliasOperations.destroy({ params: { id: alias.id }, bypassAuth: true }))
            .rejects.toThrow(new Smorekopp('BAD PARAMETERS'))
    })

    test('can destroy alias with no notification channel', async () => {
        const alias = await aliasOperations.create({
            data: { localPart: 'test-orphan', domain: 'omega.ntnu.no', description: '' },
            bypassAuth: true,
        })
        await aliasOperations.destroy({ params: { id: alias.id }, bypassAuth: true })
        expect(await prisma.mailAlias.findUnique({ where: { id: alias.id } })).toBeNull()
    })
})

// ─── Mail Flow Traversal ──────────────────────────────────────────────────────

describe('mail flow traversal', () => {
    test('traversal from alias shows connected mailing list and external address', async () => {
        const alias = await aliasOperations.create({
            data: { localPart: 'test-flow', domain: 'omega.ntnu.no', description: '' },
            bypassAuth: true,
        })
        const list = await mailingListOperations.create({
            data: { name: 'test-flow-list', description: '' },
            bypassAuth: true,
        })
        const ext = await mailAddressExternalOperations.create({
            data: { address: 'external@gmail.com', description: '' },
            bypassAuth: true,
        })

        await mailOperations.createAliasMailingListRelation({
            data: { mailAliasId: alias.id, mailingListId: list.id },
            bypassAuth: true,
        })
        await mailOperations.createMailingListExternalRelation({
            data: { mailingListId: list.id, mailAddressExternalId: ext.id },
            bypassAuth: true,
        })

        const flow = await mailTraversalReadOfType.alias({
            params: { id: alias.id },
            bypassAuth: true,
        })

        expect(flow.alias).toHaveLength(1)
        expect(flow.alias[0].id).toBe(alias.id)
        expect(flow.mailingList).toHaveLength(1)
        expect(flow.mailingList[0].id).toBe(list.id)
        expect(flow.mailaddressExternal).toHaveLength(1)
        expect(flow.mailaddressExternal[0].id).toBe(ext.id)
    })

    test('traversal from mailing list shows connected aliases and external addresses', async () => {
        const alias1 = await aliasOperations.create({
            data: { localPart: 'test-alias1', domain: 'omega.ntnu.no', description: '' },
            bypassAuth: true,
        })
        const alias2 = await aliasOperations.create({
            data: { localPart: 'test-alias2', domain: 'omega.ntnu.no', description: '' },
            bypassAuth: true,
        })
        const list = await mailingListOperations.create({
            data: { name: 'test-multi-alias-list', description: '' },
            bypassAuth: true,
        })
        const ext = await mailAddressExternalOperations.create({
            data: { address: 'multi@gmail.com', description: '' },
            bypassAuth: true,
        })

        await mailOperations.createAliasMailingListRelation({
            data: { mailAliasId: alias1.id, mailingListId: list.id },
            bypassAuth: true,
        })
        await mailOperations.createAliasMailingListRelation({
            data: { mailAliasId: alias2.id, mailingListId: list.id },
            bypassAuth: true,
        })
        await mailOperations.createMailingListExternalRelation({
            data: { mailingListId: list.id, mailAddressExternalId: ext.id },
            bypassAuth: true,
        })

        const flow = await mailTraversalReadOfType.mailingList({
            params: { id: list.id },
            bypassAuth: true,
        })

        expect(flow.mailingList).toHaveLength(1)
        expect(flow.alias.map(alias => alias.id)).toEqual(expect.arrayContaining([alias1.id, alias2.id]))
        expect(flow.mailaddressExternal).toHaveLength(1)
        expect(flow.mailaddressExternal[0].id).toBe(ext.id)
    })

    test('traversal from mailing list via group shows connected user', async () => {
        const { order } = await omegaOrderOperations.readCurrent({ bypassAuth: true })
        const group = await prisma.group.create({
            data: {
                groupType: 'MANUAL_GROUP',
                order,
                manualGroup: { create: { name: 'mail-via-group', shortName: 'mail-via-group' } },
            },
        })
        testGroupIds.push(group.id)
        const user = await prisma.user.create({
            data: {
                username: 'test-group-user',
                email: 'test-group@test.test',
                bioParagraph: { create: {} },
                ledgerAccount: { create: { type: 'USER' } },
            },
        })
        await prisma.membership.create({
            data: { userId: user.id, groupId: group.id, admin: false, active: true, order },
        })

        const list = await mailingListOperations.create({
            data: { name: 'test-group-traversal', description: '' },
            bypassAuth: true,
        })

        await mailOperations.createMailingListGroupRelation({
            data: { mailingListId: list.id, groupId: group.id },
            bypassAuth: true,
        })

        const flow = await mailTraversalReadOfType.mailingList({
            params: { id: list.id },
            bypassAuth: true,
        })

        expect(flow.mailingList).toHaveLength(1)
        expect(flow.group.map(flowGroup => flowGroup.id)).toContain(group.id)
        expect(flow.user.map(flowUser => flowUser.id)).toContain(user.id)
    })

    test('inactive group members are not part of the mail flow', async () => {
        const { order } = await omegaOrderOperations.readCurrent({ bypassAuth: true })
        const group = await prisma.group.create({
            data: {
                groupType: 'MANUAL_GROUP',
                order,
                manualGroup: { create: { name: 'mail-inactive-members', shortName: 'mail-inactive-members' } },
            },
        })
        testGroupIds.push(group.id)
        const activeUser = await prisma.user.create({
            data: {
                username: 'test-active-member',
                email: 'test-active-member@test.test',
                bioParagraph: { create: {} },
                ledgerAccount: { create: { type: 'USER' } },
            },
        })
        const inactiveUser = await prisma.user.create({
            data: {
                username: 'test-inactive-member',
                email: 'test-inactive-member@test.test',
                bioParagraph: { create: {} },
                ledgerAccount: { create: { type: 'USER' } },
            },
        })
        await prisma.membership.create({
            data: { userId: activeUser.id, groupId: group.id, admin: false, active: true, order },
        })
        await prisma.membership.create({
            data: { userId: inactiveUser.id, groupId: group.id, admin: false, active: false, order },
        })

        const list = await mailingListOperations.create({
            data: { name: 'test-inactive-traversal', description: '' },
            bypassAuth: true,
        })

        await mailOperations.createMailingListGroupRelation({
            data: { mailingListId: list.id, groupId: group.id },
            bypassAuth: true,
        })

        const flow = await mailTraversalReadOfType.mailingList({
            params: { id: list.id },
            bypassAuth: true,
        })

        expect(flow.user.map(flowUser => flowUser.id)).toContain(activeUser.id)
        expect(flow.user.map(flowUser => flowUser.id)).not.toContain(inactiveUser.id)
    })

    test('external address appearing via multiple mailing lists is deduplicated in alias traversal', async () => {
        const alias = await aliasOperations.create({
            data: { localPart: 'test-dedup', domain: 'omega.ntnu.no', description: '' },
            bypassAuth: true,
        })
        const list1 = await mailingListOperations.create({
            data: { name: 'test-dedup-list-1', description: '' },
            bypassAuth: true,
        })
        const list2 = await mailingListOperations.create({
            data: { name: 'test-dedup-list-2', description: '' },
            bypassAuth: true,
        })
        const ext = await mailAddressExternalOperations.create({
            data: { address: 'shared@gmail.com', description: '' },
            bypassAuth: true,
        })

        // alias → list1 → ext
        await mailOperations.createAliasMailingListRelation({
            data: { mailAliasId: alias.id, mailingListId: list1.id },
            bypassAuth: true,
        })
        // alias → list2 → ext (same ext reachable via two paths)
        await mailOperations.createAliasMailingListRelation({
            data: { mailAliasId: alias.id, mailingListId: list2.id },
            bypassAuth: true,
        })
        await mailOperations.createMailingListExternalRelation({
            data: { mailingListId: list1.id, mailAddressExternalId: ext.id },
            bypassAuth: true,
        })
        await mailOperations.createMailingListExternalRelation({
            data: { mailingListId: list2.id, mailAddressExternalId: ext.id },
            bypassAuth: true,
        })

        const flow = await mailTraversalReadOfType.alias({
            params: { id: alias.id },
            bypassAuth: true,
        })

        // ext is reachable via two lists but should only appear once
        expect(flow.mailaddressExternal).toHaveLength(1)
        expect(flow.mailaddressExternal[0].id).toBe(ext.id)
        expect(flow.mailingList).toHaveLength(2)
    })
})

// ─── Destroy Relation Guards ──────────────────────────────────────────────────

describe('destroy mailing list user relation', () => {
    test('throws NOT FOUND when user is connected to list only via a group', async () => {
        const { order } = await omegaOrderOperations.readCurrent({ bypassAuth: true })
        const group = await prisma.group.create({
            data: {
                groupType: 'MANUAL_GROUP',
                order,
                manualGroup: { create: { name: 'mail-destroy-user-relation', shortName: 'mail-destroy-user-relation' } },
            },
        })
        testGroupIds.push(group.id)
        const user = await prisma.user.create({
            data: {
                username: 'test-destroy-user',
                email: 'test-destroy@test.test',
                bioParagraph: { create: {} },
                ledgerAccount: { create: { type: 'USER' } },
            },
        })
        await prisma.membership.create({
            data: { userId: user.id, groupId: group.id, admin: false, active: true, order },
        })

        const list = await mailingListOperations.create({
            data: { name: 'test-destroy-list', description: '' },
            bypassAuth: true,
        })

        await mailOperations.createMailingListGroupRelation({
            data: { mailingListId: list.id, groupId: group.id },
            bypassAuth: true,
        })

        // User is reachable via group but has no direct MailingListUser record
        await expect(mailOperations.destroyMailingListUserRelation({
            data: { userId: user.id, mailingListId: list.id },
            bypassAuth: true,
        })).rejects.toThrow(new Smorekopp('NOT FOUND'))
    })

    test('can destroy direct user relation when one exists', async () => {
        const user = await prisma.user.create({
            data: {
                username: 'test-direct-user',
                email: 'test-direct@test.test',
                bioParagraph: { create: {} },
                ledgerAccount: { create: { type: 'USER' } },
            },
        })
        const list = await mailingListOperations.create({
            data: { name: 'test-direct-list', description: '' },
            bypassAuth: true,
        })

        await mailOperations.createMailingListUserRelation({
            data: { userId: user.id, mailingListId: list.id },
            bypassAuth: true,
        })

        await mailOperations.destroyMailingListUserRelation({
            data: { userId: user.id, mailingListId: list.id },
            bypassAuth: true,
        })

        expect(await prisma.mailingListUser.findUnique({
            where: { mailingListId_userId: { mailingListId: list.id, userId: user.id } },
        })).toBeNull()
    })
})
