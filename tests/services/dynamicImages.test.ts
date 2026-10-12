import { Session } from '@/auth/session/Session'
import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { dynamicImageOperations } from '@/services/images/dynamic/operations'
import { beforeAll, beforeEach, describe, expect, test } from '@jest/globals'
import type { SessionMaybeUser } from '@/auth/session/Session'
import type { MembershipFiltered } from '@/services/groups/types'
import type { VisibilityMatrix } from '@/services/visibility/types'

/**
 * These tests are about the authorization of the dynamic image service rather than its image
 * handling: every operation is gated on the collection's own double level visibility (REGULAR to
 * see, ADMIN to change), with IMAGE_ADMIN as a global bypass, so that is what is pinned down here.
 */

let currentOrder: number
let groupOne: number
let groupTwo: number
let collectionCounter = 0

/** A session that is an active member of the given groups, holding no permissions at all. */
function sessionInGroups(...groupIds: number[]) {
    const memberships: MembershipFiltered[] = groupIds.map(groupId => ({
        groupId,
        order: currentOrder,
        active: true,
        admin: false,
    }))
    return Session.fromJsObject({ user: null, permissions: [], memberships })
}

function sessionWithPermissions(...permissions: Parameters<typeof Session.fromDefaultPermissions>[0]) {
    return Session.fromJsObject({ user: null, permissions, memberships: [] })
}

function activeIn(groupId: number): VisibilityMatrix {
    return { requirements: [{ conditions: [{ type: 'ACTIVE', groupId }] }] }
}

/** One requirement satisfied by being active in any one of the given groups. */
function activeInAnyOf(...groupIds: number[]): VisibilityMatrix {
    return { requirements: [{ conditions: groupIds.map(groupId => ({ type: 'ACTIVE', groupId })) }] }
}

async function createManualGroup(shortName: string) {
    const group = await prisma.group.create({
        data: {
            groupType: 'MANUAL_GROUP',
            order: currentOrder,
            manualGroup: { create: { name: shortName, shortName } },
        },
    })
    return group.id
}

/**
 * Creates a collection through the service. The admin level is mandatory at creation - an empty one
 * would be vacuously true in checkVisibility and leave the collection open to everyone - so it goes
 * straight into createCollection rather than being written afterwards. That also removes the old
 * "admin level first" ordering dance: there is no window in which the level is empty.
 *
 * A test that does not care about administration gets adminDefault, and the regular level is left
 * empty (readable by anyone) unless one is asked for.
 */
async function createCollection({
    regularLevel,
    adminLevel,
}: {
    regularLevel?: VisibilityMatrix,
    adminLevel?: VisibilityMatrix,
} = {}) {
    collectionCounter++
    const admin = adminLevel ?? regularLevel ?? adminDefault()

    const collection = await dynamicImageOperations.createCollection({
        data: {
            collectionName: `Test collection ${collectionCounter}`,
            collectionDescription: 'Laget av testene',
            visibilityAdminRequirements: admin.requirements,
        },
        session: sessionWithPermissions('IMAGE_CREATE'),
    })

    if (regularLevel) {
        await dynamicImageOperations.visibility.updateRegularLevel({
            implementationParams: { collectionId: collection.id },
            params: { visibilityId: collection.visibilityRegularId },
            data: regularLevel,
            session: sessionInGroups(...groupIdsOf(admin)),
        })
    }

    return collection
}

/** The admin level a test gets when it does not ask for one - satisfied by sessionInGroups(groupOne). */
function adminDefault(): VisibilityMatrix {
    return activeIn(groupOne)
}

/** The group ids named by every ACTIVE/ORDER condition of a matrix - enough to satisfy it in tests. */
function groupIdsOf(visibility: VisibilityMatrix): number[] {
    return visibility.requirements.flatMap(
        requirement => requirement.conditions.map(condition => condition.groupId)
    )
}

beforeAll(async () => {
    const order = await prisma.omegaOrder.findFirstOrThrow({ orderBy: { order: 'desc' } })
    currentOrder = order.order

    groupOne = await createManualGroup('dynamic-image-test-group-one')
    groupTwo = await createManualGroup('dynamic-image-test-group-two')
})

beforeEach(async () => {
    // Collections created by a previous test would otherwise show up in the paging tests.
    await prisma.imageCollection.deleteMany({ where: { special: null } })
})

describe('creating a dynamic collection', () => {
    test('requires the IMAGE_CREATE permission', async () => {
        await expect(dynamicImageOperations.createCollection({
            data: {
                collectionName: 'Ulovlig samling',
                collectionDescription: 'Skal ikke lages',
                visibilityAdminRequirements: adminDefault().requirements,
            },
            session: Session.empty(),
        })).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))

        expect(await prisma.imageCollection.count({ where: { name: 'Ulovlig samling' } })).toBe(0)
    })

    test('refuses an empty admin level, which would authorize everyone', async () => {
        await expect(dynamicImageOperations.createCollection({
            data: {
                collectionName: 'Åpen samling',
                collectionDescription: 'Skal ikke lages',
                visibilityAdminRequirements: [],
            },
            session: sessionWithPermissions('IMAGE_CREATE'),
        })).rejects.toThrow(Smorekopp)

        expect(await prisma.imageCollection.count({ where: { name: 'Åpen samling' } })).toBe(0)
    })

    test('starts out administrated by the given level, and readable by anyone', async () => {
        const collection = await createCollection({ adminLevel: activeIn(groupOne) })

        const matrix = await dynamicImageOperations.visibility.readDoubleLevelMatrix({
            params: { collectionId: collection.id },
            session: Session.empty(),
        })

        expect(matrix.regularLevel).toEqual({ requirements: [] })
        expect(matrix.adminLevel).toEqual(activeIn(groupOne))
    })

    test('a session outside the admin level cannot administrate a fresh collection', async () => {
        const collection = await createCollection({ adminLevel: activeIn(groupOne) })

        await expect(dynamicImageOperations.destroyCollection({
            params: { collectionId: collection.id },
            session: Session.empty(),
        })).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))

        expect(await prisma.imageCollection.count({ where: { id: collection.id } })).toBe(1)
    })
})

describe('reading a collection', () => {
    test('a collection with an empty regular level is readable by anyone', async () => {
        const collection = await createCollection()

        await expect(dynamicImageOperations.readCollection({
            params: { collectionId: collection.id },
            session: Session.empty(),
        })).resolves.toMatchObject({ id: collection.id })
    })

    test('the regular level gates reading', async () => {
        const collection = await createCollection({ regularLevel: activeIn(groupOne) })

        await expect(dynamicImageOperations.readCollection({
            params: { collectionId: collection.id },
            session: sessionInGroups(groupOne),
        })).resolves.toMatchObject({ id: collection.id })

        await expect(dynamicImageOperations.readCollection({
            params: { collectionId: collection.id },
            session: sessionInGroups(groupTwo),
        })).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))

        await expect(dynamicImageOperations.readCollection({
            params: { collectionId: collection.id },
            session: Session.empty(),
        })).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))
    })

    test('IMAGE_ADMIN bypasses the regular level', async () => {
        const collection = await createCollection({ regularLevel: activeIn(groupOne) })

        await expect(dynamicImageOperations.readCollection({
            params: { collectionId: collection.id },
            session: sessionWithPermissions('IMAGE_ADMIN'),
        })).resolves.toMatchObject({ id: collection.id })
    })

    test('a collection can also be read by name', async () => {
        const collection = await createCollection()

        await expect(dynamicImageOperations.readCollection({
            params: { collectionName: collection.name },
            session: Session.empty(),
        })).resolves.toMatchObject({ id: collection.id })
    })
})

describe('changing a collection', () => {
    test('updating requires the admin level, not the regular level', async () => {
        const collection = await createCollection({
            regularLevel: activeInAnyOf(groupOne, groupTwo),
            adminLevel: activeIn(groupTwo),
        })

        // groupOne may see the collection, but may not change it.
        await expect(dynamicImageOperations.updateCollection({
            params: { collectionId: collection.id },
            data: { collectionName: 'Nytt navn' },
            session: sessionInGroups(groupOne),
        })).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))

        await dynamicImageOperations.updateCollection({
            params: { collectionId: collection.id },
            data: { collectionName: 'Nytt navn' },
            session: sessionInGroups(groupTwo),
        })

        expect(await prisma.imageCollection.findUniqueOrThrow({
            where: { id: collection.id },
        })).toMatchObject({ name: 'Nytt navn' })
    })

    test('IMAGE_ADMIN bypasses the admin level', async () => {
        const collection = await createCollection({ adminLevel: activeIn(groupOne) })

        await dynamicImageOperations.updateCollection({
            params: { collectionId: collection.id },
            data: { collectionName: 'Endret av bildeadmin' },
            session: sessionWithPermissions('IMAGE_ADMIN'),
        })

        expect(await prisma.imageCollection.findUniqueOrThrow({
            where: { id: collection.id },
        })).toMatchObject({ name: 'Endret av bildeadmin' })
    })

    test('destroying requires the admin level', async () => {
        const collection = await createCollection({ adminLevel: activeIn(groupOne) })

        await expect(dynamicImageOperations.destroyCollection({
            params: { collectionId: collection.id },
            session: sessionInGroups(groupTwo),
        })).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))

        expect(await prisma.imageCollection.count({ where: { id: collection.id } })).toBe(1)

        await dynamicImageOperations.destroyCollection({
            params: { collectionId: collection.id },
            session: sessionInGroups(groupOne),
        })

        expect(await prisma.imageCollection.count({ where: { id: collection.id } })).toBe(0)
    })

    test('destroying a collection also removes both of its visibilities', async () => {
        const collection = await createCollection()

        await dynamicImageOperations.destroyCollection({
            params: { collectionId: collection.id },
            session: sessionInGroups(...groupIdsOf(adminDefault())),
        })

        expect(await prisma.visibility.count({
            where: { id: { in: [collection.visibilityRegularId, collection.visibilityAdminId] } },
        })).toBe(0)
    })
})

describe('the collections visibility', () => {
    test('the double level matrix is readable with the regular level', async () => {
        const collection = await createCollection({ regularLevel: activeIn(groupOne) })

        await expect(dynamicImageOperations.visibility.readDoubleLevelMatrix({
            params: { collectionId: collection.id },
            session: sessionInGroups(groupTwo),
        })).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))

        await expect(dynamicImageOperations.visibility.readDoubleLevelMatrix({
            params: { collectionId: collection.id },
            session: sessionInGroups(groupOne),
        })).resolves.toMatchObject({ regularLevel: activeIn(groupOne) })
    })

    test('changing either level requires the admin level', async () => {
        const collection = await createCollection({ adminLevel: activeIn(groupOne) })

        await expect(dynamicImageOperations.visibility.updateRegularLevel({
            implementationParams: { collectionId: collection.id },
            params: { visibilityId: collection.visibilityRegularId },
            data: activeIn(groupTwo),
            session: sessionInGroups(groupTwo),
        })).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))

        await expect(dynamicImageOperations.visibility.updateAdminLevel({
            implementationParams: { collectionId: collection.id },
            params: { visibilityId: collection.visibilityAdminId },
            data: activeIn(groupTwo),
            session: sessionInGroups(groupTwo),
        })).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))
    })

    test('an administrator may not lock themselves out by narrowing the regular level', async () => {
        const collection = await createCollection({ adminLevel: activeIn(groupOne) })

        await expect(dynamicImageOperations.visibility.updateRegularLevel({
            implementationParams: { collectionId: collection.id },
            params: { visibilityId: collection.visibilityRegularId },
            data: activeIn(groupTwo),
            session: sessionInGroups(groupOne),
        })).rejects.toThrow(new Smorekopp('BAD DATA'))
    })

    test('the visibility of one collection cannot be changed through another', async () => {
        const [collection, otherCollection] = [await createCollection(), await createCollection()]

        await expect(dynamicImageOperations.visibility.updateRegularLevel({
            implementationParams: { collectionId: collection.id },
            params: { visibilityId: otherCollection.visibilityRegularId },
            data: activeIn(groupOne),
            // Passes the admin level of `collection`, so the request fails on ownership rather
            // than on authorization.
            session: sessionInGroups(...groupIdsOf(adminDefault())),
        })).rejects.toThrow(new Smorekopp('DISSALLOWED'))
    })
})

describe('paging over collections', () => {
    const readPage = (session: SessionMaybeUser, onlyAdministrated = false) =>
        dynamicImageOperations.readCollectionPage({
            params: {
                paging: {
                    page: { pageSize: 12, page: 0, cursor: null },
                    details: { showOnlyCollectionsSessionAdministrates: onlyAdministrated },
                },
            },
            session,
        })

    test('only collections the session may see are listed', async () => {
        const visible = await createCollection({ regularLevel: activeIn(groupOne) })
        const hidden = await createCollection({ regularLevel: activeIn(groupTwo) })

        const ids = (await readPage(sessionInGroups(groupOne))).map(collection => collection.id)

        expect(ids).toContain(visible.id)
        expect(ids).not.toContain(hidden.id)
    })

    test('IMAGE_ADMIN sees every collection', async () => {
        const first = await createCollection({ regularLevel: activeIn(groupOne) })
        const second = await createCollection({ regularLevel: activeIn(groupTwo) })

        const ids = (await readPage(sessionWithPermissions('IMAGE_ADMIN'))).map(collection => collection.id)

        expect(ids).toEqual(expect.arrayContaining([first.id, second.id]))
    })

    test('special collections are never listed among the dynamic ones', async () => {
        const specialCount = await prisma.imageCollection.count({ where: { special: { not: null } } })
        expect(specialCount).toBeGreaterThan(0)

        const collections = await readPage(sessionWithPermissions('IMAGE_ADMIN'))

        expect(collections.every(collection => collection.special === null)).toBe(true)
    })

    test('filtering on administrated collections uses the admin level', async () => {
        const administrated = await createCollection({ adminLevel: activeIn(groupOne) })
        const onlyVisible = await createCollection({ adminLevel: activeIn(groupTwo) })

        const ids = (await readPage(sessionInGroups(groupOne), true)).map(collection => collection.id)

        expect(ids).toContain(administrated.id)
        expect(ids).not.toContain(onlyVisible.id)
    })
})

describe('admin levels', () => {
    test('one requirement with no conditions leaves the collection to IMAGE_ADMIN', async () => {
        const collection = await prisma.imageCollection.create({
            data: {
                name: `Migrert samling ${++collectionCounter}`,
                visibilityRegular: { create: {} },
                visibilityAdmin: { create: { requirements: { create: [{}] } } },
            },
        })

        await expect(dynamicImageOperations.updateCollection({
            params: { collectionId: collection.id },
            data: { collectionName: 'Kapret' },
            session: sessionInGroups(groupOne),
        })).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))

        await dynamicImageOperations.destroyCollection({
            params: { collectionId: collection.id },
            session: sessionWithPermissions('IMAGE_ADMIN'),
        })

        expect(await prisma.imageCollection.count({ where: { id: collection.id } })).toBe(0)
    })

    test('the admin level cannot be emptied', async () => {
        const collection = await createCollection({ adminLevel: activeIn(groupOne) })

        await expect(dynamicImageOperations.visibility.updateAdminLevel({
            implementationParams: { collectionId: collection.id },
            params: { visibilityId: collection.visibilityAdminId },
            data: { requirements: [] },
            session: sessionInGroups(groupOne),
        })).rejects.toThrow(new Smorekopp('BAD DATA'))
    })
})

describe('special collections are not reachable through the dynamic service', () => {
    test('reading a special collection by name is refused', async () => {
        const special = await prisma.imageCollection.findFirstOrThrow({ where: { special: { not: null } } })

        await expect(dynamicImageOperations.readCollection({
            params: { collectionName: special.name },
            session: sessionWithPermissions('IMAGE_ADMIN'),
        })).rejects.toThrow(Smorekopp)
    })

    test('destroying a special collection is refused', async () => {
        const special = await prisma.imageCollection.findFirstOrThrow({ where: { special: { not: null } } })

        await expect(dynamicImageOperations.destroyCollection({
            params: { collectionId: special.id },
            session: sessionWithPermissions('IMAGE_ADMIN'),
        })).rejects.toThrow(Smorekopp)

        expect(await prisma.imageCollection.count({ where: { id: special.id } })).toBe(1)
    })
})
