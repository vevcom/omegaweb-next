import { Session } from '@/auth/session/Session'
import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { permissionOperations } from '@/services/permissions/operations'
import { userOperations } from '@/services/users/operations'
import { afterEach, beforeAll, describe, expect, test } from '@jest/globals'
import type { Permission } from '@/prisma-generated-pn-types'

let currentOrder: number
const testGroupIds: number[] = []

beforeAll(async () => {
    currentOrder = (await prisma.omegaOrder.findFirstOrThrow({ orderBy: { order: 'desc' } })).order
})

afterEach(async () => {
    await prisma.defaultPermission.deleteMany()
    await prisma.groupPermission.deleteMany({ where: { groupId: { in: testGroupIds } } })
    await prisma.membership.deleteMany({ where: { groupId: { in: testGroupIds } } })
    await prisma.manualGroup.deleteMany({ where: { groupId: { in: testGroupIds } } })
    await prisma.group.deleteMany({ where: { id: { in: testGroupIds } } })
    testGroupIds.length = 0
})

async function createTestUser(username: string) {
    return userOperations.create({
        data: {
            email: `${username}@omega.ntnu.no`,
            firstname: 'Test',
            lastname: 'Testesen',
            username,
            emailVerified: new Date().toISOString(),
        },
        bypassAuth: true,
    })
}

async function createGroup(shortName: string, permissions: Permission[] = []) {
    const group = await prisma.group.create({
        data: {
            groupType: 'MANUAL_GROUP',
            order: currentOrder,
            manualGroup: { create: { name: shortName, shortName } },
            permissions: { createMany: { data: permissions.map(permission => ({ permission })) } },
        },
    })
    testGroupIds.push(group.id)
    return group.id
}

async function addMember(groupId: number, userId: number, active = true) {
    await prisma.membership.create({
        data: { groupId, userId, order: currentOrder, admin: false, active },
    })
}

/**
 * A session holding the given permissions. A user is attached so a refusal reads as UNAUTHORIZED
 * rather than UNAUTHENTICATED.
 */
async function sessionWith(username: string, permissions: Permission[]) {
    return Session.fromJsObject({
        user: await createTestUser(username),
        permissions,
        memberships: [],
    })
}

const readPermissionsOfUser = (userId: number) => permissionOperations.readPermissionsOfUser({
    params: { userId },
    bypassAuth: true,
})

const readPermissionsOfGroup = (groupId: number) => permissionOperations.readPermissionsOfGroup({
    params: { groupId },
    bypassAuth: true,
})

/** Pushes the user's updatedAt into the past, so a later session invalidation can be told apart. */
async function backdateUser(userId: number) {
    const past = new Date(Date.now() - 60 * 60 * 1000)
    await prisma.user.update({ where: { id: userId }, data: { updatedAt: past } })
    return past
}

describe('readPermissionsOfUser', () => {
    test('is the default permissions together with those of every group the user is active in', async () => {
        const user = await createTestUser('permissionsreadone')
        await prisma.defaultPermission.createMany({
            data: [{ permission: 'OMEGA_ORDER_USE' }, { permission: 'JOBAD_USE' }],
        })
        await addMember(await createGroup('perm-read-one-a', ['JOBAD_USE', 'OMBUL_USE']), user.id)
        await addMember(await createGroup('perm-read-one-b', ['COMMITTEE_USE']), user.id)

        const permissions = await readPermissionsOfUser(user.id)

        // A permission held both by default and through a group is only listed once.
        expect([...permissions].sort()).toEqual(['COMMITTEE_USE', 'JOBAD_USE', 'OMBUL_USE', 'OMEGA_ORDER_USE'])
    })

    test('leaves out the permissions of a group the user is no longer active in', async () => {
        const user = await createTestUser('permissionsreadtwo')
        await addMember(await createGroup('perm-read-two-active', ['OMBUL_USE']), user.id)
        await addMember(await createGroup('perm-read-two-former', ['OMBUL_ADMIN']), user.id, false)

        const permissions = await readPermissionsOfUser(user.id)

        expect(permissions).toContain('OMBUL_USE')
        expect(permissions).not.toContain('OMBUL_ADMIN')
    })

    test('a user may read their own permissions, but not those of someone else', async () => {
        const reader = await createTestUser('permissionsreader')
        const other = await createTestUser('permissionsreadother')
        const readerSession = Session.fromJsObject({ user: reader, permissions: [], memberships: [] })

        await expect(permissionOperations.readPermissionsOfUser({
            params: { userId: reader.id },
            session: readerSession,
        })).resolves.toBeInstanceOf(Array)

        await expect(permissionOperations.readPermissionsOfUser({
            params: { userId: other.id },
            session: readerSession,
        })).rejects.toThrow(new Smorekopp('UNAUTHORIZED'))

        await expect(permissionOperations.readPermissionsOfUser({
            params: { userId: other.id },
            session: await sessionWith('permissionsreaduse', ['PERMISSION_USE']),
        })).resolves.toBeInstanceOf(Array)
    })
})

describe('updateGroupPermission', () => {
    test('granting a permission to a group gives it to the members, and removing it takes it away', async () => {
        const member = await createTestUser('permissionsgrantmember')
        const groupId = await createGroup('perm-grant')
        await addMember(groupId, member.id)
        const session = await sessionWith('permissionsgrantadmin', ['PERMISSION_ADMIN', 'OMBUL_USE'])

        await permissionOperations.updateGroupPermission({
            params: { groupId, permission: 'OMBUL_USE' },
            data: { value: true },
            session,
        })

        expect(await readPermissionsOfGroup(groupId)).toEqual(['OMBUL_USE'])
        expect(await readPermissionsOfUser(member.id)).toContain('OMBUL_USE')

        await permissionOperations.updateGroupPermission({
            params: { groupId, permission: 'OMBUL_USE' },
            data: { value: false },
            session,
        })

        expect(await readPermissionsOfGroup(groupId)).toEqual([])
        expect(await readPermissionsOfUser(member.id)).not.toContain('OMBUL_USE')
    })

    test('invalidates the sessions of the active members of the group', async () => {
        const member = await createTestUser('permissionsinvalidate')
        const groupId = await createGroup('perm-invalidate')
        await addMember(groupId, member.id)
        const past = await backdateUser(member.id)

        await permissionOperations.updateGroupPermission({
            params: { groupId, permission: 'OMBUL_USE' },
            data: { value: true },
            session: await sessionWith('permissionsinvalidateadmin', ['PERMISSION_ADMIN', 'OMBUL_USE']),
        })

        // A JWT issued before this carries the old permissions, so it has to be rejected.
        const { updatedAt } = await prisma.user.findUniqueOrThrow({ where: { id: member.id } })
        expect(updatedAt.getTime()).toBeGreaterThan(past.getTime())
    })

    test('is refused without PERMISSION_ADMIN', async () => {
        const groupId = await createGroup('perm-refused')

        await expect(permissionOperations.updateGroupPermission({
            params: { groupId, permission: 'OMBUL_USE' },
            data: { value: true },
            session: await sessionWith('permissionsrefuseduse', ['PERMISSION_USE', 'OMBUL_USE']),
        })).rejects.toThrow(new Smorekopp('UNAUTHORIZED'))

        await expect(permissionOperations.updateGroupPermission({
            params: { groupId, permission: 'OMBUL_USE' },
            data: { value: true },
            session: Session.empty(),
        })).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))

        expect(await readPermissionsOfGroup(groupId)).toEqual([])
    })

    test('a refused removal leaves the permission in place', async () => {
        const groupId = await createGroup('perm-refused-removal', ['OMBUL_USE'])

        await expect(permissionOperations.updateGroupPermission({
            params: { groupId, permission: 'OMBUL_USE' },
            data: { value: false },
            session: await sessionWith('permissionsrefusedremoval', ['PERMISSION_USE', 'OMBUL_USE']),
        })).rejects.toThrow(new Smorekopp('UNAUTHORIZED'))

        expect(await readPermissionsOfGroup(groupId)).toEqual(['OMBUL_USE'])
    })
})

describe('updateDefaultPermissions', () => {
    test('replaces the default permissions, and every user gets the new ones', async () => {
        const user = await createTestUser('permissionsdefaults')
        const session = await sessionWith('permissionsdefaultsadmin', [
            'PERMISSION_ADMIN', 'OMBUL_USE', 'JOBAD_USE', 'COMMITTEE_USE',
        ])

        await permissionOperations.updateDefaultPermissions({
            data: { permissions: ['OMBUL_USE', 'JOBAD_USE'] },
            session,
        })
        expect([...await permissionOperations.readDefaultPermissions({})].sort()).toEqual(['JOBAD_USE', 'OMBUL_USE'])

        await permissionOperations.updateDefaultPermissions({
            data: { permissions: ['JOBAD_USE', 'COMMITTEE_USE'] },
            session,
        })
        expect([...await permissionOperations.readDefaultPermissions({})].sort()).toEqual(['COMMITTEE_USE', 'JOBAD_USE'])

        const permissions = await readPermissionsOfUser(user.id)
        expect(permissions).toEqual(expect.arrayContaining(['COMMITTEE_USE', 'JOBAD_USE']))
        expect(permissions).not.toContain('OMBUL_USE')
    })

    test('invalidates the session of every user', async () => {
        const user = await createTestUser('permissionsdefaultsinvalidate')
        const past = await backdateUser(user.id)

        await permissionOperations.updateDefaultPermissions({
            data: { permissions: ['JOBAD_USE'] },
            session: await sessionWith('permissionsdefaultsinvalidateadmin', ['PERMISSION_ADMIN', 'JOBAD_USE']),
        })

        const { updatedAt } = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
        expect(updatedAt.getTime()).toBeGreaterThan(past.getTime())
    })

    test('is refused without PERMISSION_ADMIN', async () => {
        await prisma.defaultPermission.create({ data: { permission: 'JOBAD_USE' } })

        await expect(permissionOperations.updateDefaultPermissions({
            data: { permissions: ['OMBUL_USE'] },
            session: await sessionWith('permissionsdefaultsrefused', ['PERMISSION_USE', 'OMBUL_USE']),
        })).rejects.toThrow(new Smorekopp('UNAUTHORIZED'))

        await expect(permissionOperations.updateDefaultPermissions({
            data: { permissions: ['OMBUL_USE'] },
            session: Session.empty(),
        })).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))

        expect(await permissionOperations.readDefaultPermissions({})).toEqual(['JOBAD_USE'])
    })
})
