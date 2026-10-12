import { checkVisibility } from '@/auth/visibility/checkVisibility'
import { isSubVisibility } from '@/auth/visibility/isSubVisibility'
import { Require } from '@/auth/authorizer/Require'
import { Session } from '@/auth/session/Session'
import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { visibilityOperations } from '@/services/visibility/operations'
import { implementDoubleLevelVisibilityOperations } from '@/services/visibility/implement'
import { beforeAll, beforeEach, describe, expect, test } from '@jest/globals'
import { z } from 'zod'
import type { MembershipFiltered } from '@/services/groups/types'
import type { VisibilityMatrix } from '@/services/visibility/types'

/**
 * A standalone implementation of the double level visibility contract. It deliberately owns no
 * domain model of its own - its implementationParams are just the two visibility ids - so that
 * everything `implementDoubleLevelVisibilityOperations` provides (the matrix read, both level
 * updates, the ownership check and the admin-is-a-sub-of-regular invariant) is exercised without
 * dragging in image collections or any other owning service.
 */
const testDoubleLevelVisibility = implementDoubleLevelVisibilityOperations({
    implementationParamsSchema: z.object({
        regularId: z.number(),
        adminId: z.number(),
    }),
    authorizers: {
        readDoubleLevelMatrix: ({ doubleLevelMatrix }) =>
            Require.levelOfDoubleVisibility({ level: 'regularLevel' }).data({ visibility: doubleLevelMatrix }),
        updateRegularLevel: ({ doubleLevelMatrix }) =>
            Require.levelOfDoubleVisibility({ level: 'adminLevel' }).data({ visibility: doubleLevelMatrix }),
        updateAdminLevel: ({ doubleLevelMatrix }) =>
            Require.levelOfDoubleVisibility({ level: 'adminLevel' }).data({ visibility: doubleLevelMatrix }),
    },
    readDoubleLevel: async ({ prisma: client, implementationParams, include }) => {
        const [regularLevel, adminLevel] = await Promise.all([
            client.visibility.findUniqueOrThrow({ where: { id: implementationParams.regularId }, include }),
            client.visibility.findUniqueOrThrow({ where: { id: implementationParams.adminId }, include }),
        ])
        return { regularLevel, adminLevel }
    },
})

let currentOrder: number
let groupOne: number
let groupTwo: number

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

function activeIn(groupId: number): VisibilityMatrix {
    return { requirements: [{ conditions: [{ type: 'ACTIVE', groupId }] }] }
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

/** Reads a stored visibility back as the plain matrix shape, for asserting on what was written. */
async function readStoredMatrix(visibilityId: number): Promise<VisibilityMatrix> {
    const visibility = await prisma.visibility.findUniqueOrThrow({
        where: { id: visibilityId },
        include: { requirements: { include: { conditions: true } } },
    })
    return {
        requirements: visibility.requirements.map(requirement => ({
            conditions: requirement.conditions.map(condition => (
                condition.type === 'ORDER'
                    ? { type: 'ORDER', groupId: condition.groupId, order: condition.order }
                    : { type: 'ACTIVE', groupId: condition.groupId }
            )),
        })),
    }
}

async function createVisibilityPair() {
    const [regular, admin] = await Promise.all([
        visibilityOperations.create.internalCall({}),
        visibilityOperations.create.internalCall({}),
    ])
    return { regularId: regular.id, adminId: admin.id }
}

/** The group ids named by every condition of a matrix - enough to satisfy it in these tests. */
function groupIdsOf(visibility: VisibilityMatrix): number[] {
    return visibility.requirements.flatMap(
        requirement => requirement.conditions.map(condition => condition.groupId)
    )
}

/**
 * Arranges a pair into the levels a test needs. The admin level is always written first: an empty
 * admin level means "everyone administrates", which is not a sub-visibility of any narrowed regular
 * level, so narrowing the regular level first would (correctly) be rejected by the invariant.
 * When only a regular level is asked for, the admin level is set to the same matrix.
 */
async function arrangeLevels(
    pair: { regularId: number, adminId: number },
    { regularLevel, adminLevel }: { regularLevel?: VisibilityMatrix, adminLevel?: VisibilityMatrix },
) {
    const admin = adminLevel ?? regularLevel

    if (admin) {
        await testDoubleLevelVisibility.updateAdminLevel({
            implementationParams: pair,
            params: { visibilityId: pair.adminId },
            data: admin,
            session: Session.empty(),
        })
    }
    if (regularLevel) {
        await testDoubleLevelVisibility.updateRegularLevel({
            implementationParams: pair,
            params: { visibilityId: pair.regularId },
            data: regularLevel,
            session: admin ? sessionInGroups(...groupIdsOf(admin)) : Session.empty(),
        })
    }
}

beforeAll(async () => {
    const order = await prisma.omegaOrder.findFirstOrThrow({ orderBy: { order: 'desc' } })
    currentOrder = order.order

    groupOne = await createManualGroup('visibility-test-group-one')
    groupTwo = await createManualGroup('visibility-test-group-two')
})

describe('checkVisibility', () => {
    const membershipInGroup = (groupId: number, active: boolean, order: number): MembershipFiltered => ({
        groupId, active, order, admin: false,
    })

    test('an empty matrix is visible to everyone', () => {
        expect(checkVisibility([], { requirements: [] })).toBe(true)
    })

    test('a requirement with no conditions can never be satisfied', () => {
        expect(checkVisibility(
            [membershipInGroup(1, true, 106)],
            { requirements: [{ conditions: [] }] },
        )).toBe(false)
    })

    test('conditions within one requirement are ORed', () => {
        const visibility: VisibilityMatrix = {
            requirements: [{
                conditions: [
                    { type: 'ACTIVE', groupId: 1 },
                    { type: 'ACTIVE', groupId: 2 },
                ],
            }],
        }

        expect(checkVisibility([membershipInGroup(2, true, 106)], visibility)).toBe(true)
        expect(checkVisibility([membershipInGroup(3, true, 106)], visibility)).toBe(false)
    })

    test('requirements are ANDed', () => {
        const visibility: VisibilityMatrix = {
            requirements: [
                { conditions: [{ type: 'ACTIVE', groupId: 1 }] },
                { conditions: [{ type: 'ACTIVE', groupId: 2 }] },
            ],
        }

        expect(checkVisibility(
            [membershipInGroup(1, true, 106), membershipInGroup(2, true, 106)],
            visibility,
        )).toBe(true)
        expect(checkVisibility([membershipInGroup(1, true, 106)], visibility)).toBe(false)
    })

    test('an ACTIVE condition is not satisfied by an inactive membership', () => {
        expect(checkVisibility(
            [membershipInGroup(1, false, 106)],
            activeIn(1),
        )).toBe(false)
    })

    test('an ORDER condition matches the exact order, active or not', () => {
        const visibility: VisibilityMatrix = {
            requirements: [{ conditions: [{ type: 'ORDER', groupId: 1, order: 105 }] }],
        }

        expect(checkVisibility([membershipInGroup(1, false, 105)], visibility)).toBe(true)
        expect(checkVisibility([membershipInGroup(1, true, 106)], visibility)).toBe(false)
    })
})

describe('isSubVisibility', () => {
    test('everything is a sub-visibility of the empty (everyone) matrix', () => {
        expect(isSubVisibility(activeIn(1), { requirements: [] })).toBe(true)
    })

    test('identical matrices are sub-visibilities of each other', () => {
        expect(isSubVisibility(activeIn(1), activeIn(1))).toBe(true)
    })

    test('a disjoint matrix is not a sub-visibility', () => {
        expect(isSubVisibility(activeIn(1), activeIn(2))).toBe(false)
    })

    test('adding a requirement narrows, so it stays a sub-visibility', () => {
        const stricter: VisibilityMatrix = {
            requirements: [
                { conditions: [{ type: 'ACTIVE', groupId: 1 }] },
                { conditions: [{ type: 'ACTIVE', groupId: 2 }] },
            ],
        }

        expect(isSubVisibility(stricter, activeIn(1))).toBe(true)
        expect(isSubVisibility(activeIn(1), stricter)).toBe(false)
    })

    test('an ACTIVE condition does not satisfy an ORDER condition on the same group', () => {
        expect(isSubVisibility(
            activeIn(1),
            { requirements: [{ conditions: [{ type: 'ORDER', groupId: 1, order: 106 }] }] },
        )).toBe(false)
    })
})

describe('visibility operations', () => {
    test('a created visibility starts out with no requirements', async () => {
        const visibility = await visibilityOperations.create.internalCall({})

        expect(await readStoredMatrix(visibility.id)).toEqual({ requirements: [] })
    })

    test('update writes the requirements, and ORDER conditions keep their order', async () => {
        const visibility = await visibilityOperations.create.internalCall({})

        await visibilityOperations.update.internalCall({
            params: { visibilityId: visibility.id },
            data: {
                requirements: [{
                    conditions: [
                        { type: 'ACTIVE', groupId: groupOne },
                        { type: 'ORDER', groupId: groupTwo, order: currentOrder - 1 },
                    ],
                }],
            },
        })

        const stored = await readStoredMatrix(visibility.id)
        expect(stored.requirements).toHaveLength(1)
        expect(stored.requirements[0].conditions).toEqual(expect.arrayContaining([
            { type: 'ACTIVE', groupId: groupOne },
            { type: 'ORDER', groupId: groupTwo, order: currentOrder - 1 },
        ]))
    })

    test('update replaces the previous requirements instead of adding to them', async () => {
        const visibility = await visibilityOperations.create.internalCall({})

        await visibilityOperations.update.internalCall({
            params: { visibilityId: visibility.id },
            data: { requirements: [{ conditions: [{ type: 'ACTIVE', groupId: groupOne }] }] },
        })
        await visibilityOperations.update.internalCall({
            params: { visibilityId: visibility.id },
            data: { requirements: [{ conditions: [{ type: 'ACTIVE', groupId: groupTwo }] }] },
        })

        expect(await readStoredMatrix(visibility.id)).toEqual(activeIn(groupTwo))
    })

    test('update to an empty matrix removes every requirement', async () => {
        const visibility = await visibilityOperations.create.internalCall({})

        await visibilityOperations.update.internalCall({
            params: { visibilityId: visibility.id },
            data: { requirements: [{ conditions: [{ type: 'ACTIVE', groupId: groupOne }] }] },
        })
        await visibilityOperations.update.internalCall({
            params: { visibilityId: visibility.id },
            data: { requirements: [] },
        })

        expect(await readStoredMatrix(visibility.id)).toEqual({ requirements: [] })
        expect(await prisma.visibilityRequirement.count({ where: { visibilityId: visibility.id } })).toBe(0)
    })

    test('destroy removes the visibility and cascades to its requirements', async () => {
        const visibility = await visibilityOperations.create.internalCall({})
        await visibilityOperations.update.internalCall({
            params: { visibilityId: visibility.id },
            data: { requirements: [{ conditions: [{ type: 'ACTIVE', groupId: groupOne }] }] },
        })

        await visibilityOperations.destroy.internalCall({ params: { visibilityId: visibility.id } })

        expect(await prisma.visibility.findUnique({ where: { id: visibility.id } })).toBeNull()
        expect(await prisma.visibilityRequirement.count({ where: { visibilityId: visibility.id } })).toBe(0)
    })
})

describe('double level visibility implementation', () => {
    let pair: { regularId: number, adminId: number }

    beforeEach(async () => {
        pair = await createVisibilityPair()
    })

    describe('reading the matrix', () => {
        test('both levels are read back as matrices', async () => {
            await testDoubleLevelVisibility.updateAdminLevel({
                implementationParams: pair,
                params: { visibilityId: pair.adminId },
                data: activeIn(groupOne),
                session: Session.empty(),
            })

            const matrix = await testDoubleLevelVisibility.readDoubleLevelMatrix({
                params: pair,
                session: sessionInGroups(groupOne),
            })

            expect(matrix.regularLevel).toEqual({ requirements: [] })
            expect(matrix.adminLevel).toEqual(activeIn(groupOne))
        })

        test('reading requires the regular level, not the admin level', async () => {
            await arrangeLevels(pair, { regularLevel: activeIn(groupOne) })

            await expect(testDoubleLevelVisibility.readDoubleLevelMatrix({
                params: pair,
                session: sessionInGroups(groupTwo),
            })).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))

            await expect(testDoubleLevelVisibility.readDoubleLevelMatrix({
                params: pair,
                session: sessionInGroups(groupOne),
            })).resolves.toBeDefined()
        })
    })

    describe('authorization of updates', () => {
        test('an empty admin level lets anyone administrate', async () => {
            await testDoubleLevelVisibility.updateAdminLevel({
                implementationParams: pair,
                params: { visibilityId: pair.adminId },
                data: activeIn(groupOne),
                session: Session.empty(),
            })

            expect(await readStoredMatrix(pair.adminId)).toEqual(activeIn(groupOne))
        })

        test('once set, only sessions satisfying the admin level may update either level', async () => {
            await testDoubleLevelVisibility.updateAdminLevel({
                implementationParams: pair,
                params: { visibilityId: pair.adminId },
                data: activeIn(groupOne),
                session: Session.empty(),
            })

            await expect(testDoubleLevelVisibility.updateRegularLevel({
                implementationParams: pair,
                params: { visibilityId: pair.regularId },
                data: { requirements: [] },
                session: sessionInGroups(groupTwo),
            })).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))

            await expect(testDoubleLevelVisibility.updateAdminLevel({
                implementationParams: pair,
                params: { visibilityId: pair.adminId },
                data: activeIn(groupTwo),
                session: sessionInGroups(groupTwo),
            })).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))

            // The rejected updates must not have written anything.
            expect(await readStoredMatrix(pair.adminId)).toEqual(activeIn(groupOne))
        })

        test('a session satisfying the admin level may update the admin level', async () => {
            await testDoubleLevelVisibility.updateAdminLevel({
                implementationParams: pair,
                params: { visibilityId: pair.adminId },
                data: activeIn(groupOne),
                session: Session.empty(),
            })

            await testDoubleLevelVisibility.updateAdminLevel({
                implementationParams: pair,
                params: { visibilityId: pair.adminId },
                data: activeIn(groupTwo),
                session: sessionInGroups(groupOne),
            })

            expect(await readStoredMatrix(pair.adminId)).toEqual(activeIn(groupTwo))
        })
    })

    describe('ownership check', () => {
        test('updateRegularLevel refuses a visibility id that is not the regular level', async () => {
            await expect(testDoubleLevelVisibility.updateRegularLevel({
                implementationParams: pair,
                params: { visibilityId: pair.adminId },
                data: activeIn(groupOne),
                session: Session.empty(),
            })).rejects.toThrow(new Smorekopp('DISSALLOWED'))
        })

        test('updateAdminLevel refuses a visibility id that is not the admin level', async () => {
            await expect(testDoubleLevelVisibility.updateAdminLevel({
                implementationParams: pair,
                params: { visibilityId: pair.regularId },
                data: activeIn(groupOne),
                session: Session.empty(),
            })).rejects.toThrow(new Smorekopp('DISSALLOWED'))
        })

        test('a visibility belonging to another pair is refused', async () => {
            const otherPair = await createVisibilityPair()

            await expect(testDoubleLevelVisibility.updateRegularLevel({
                implementationParams: pair,
                params: { visibilityId: otherPair.regularId },
                data: activeIn(groupOne),
                session: Session.empty(),
            })).rejects.toThrow(new Smorekopp('DISSALLOWED'))
        })
    })

    describe('admin level must stay a sub-visibility of the regular level', () => {
        test('the regular level cannot be narrowed while the admin level is still empty', async () => {
            // An empty admin level means everyone administrates, which is not a sub-visibility of
            // any narrowed regular level - so the admin level has to be narrowed first.
            await expect(testDoubleLevelVisibility.updateRegularLevel({
                implementationParams: pair,
                params: { visibilityId: pair.regularId },
                data: activeIn(groupOne),
                session: Session.empty(),
            })).rejects.toThrow(new Smorekopp('BAD DATA'))

            await arrangeLevels(pair, { regularLevel: activeIn(groupOne) })

            expect(await readStoredMatrix(pair.regularId)).toEqual(activeIn(groupOne))
        })

        test('narrowing the regular level away from the admin level is rejected', async () => {
            await testDoubleLevelVisibility.updateAdminLevel({
                implementationParams: pair,
                params: { visibilityId: pair.adminId },
                data: activeIn(groupOne),
                session: Session.empty(),
            })

            await expect(testDoubleLevelVisibility.updateRegularLevel({
                implementationParams: pair,
                params: { visibilityId: pair.regularId },
                data: activeIn(groupTwo),
                session: sessionInGroups(groupOne),
            })).rejects.toThrow(new Smorekopp('BAD DATA'))

            // The invariant is checked before anything is written.
            expect(await readStoredMatrix(pair.regularId)).toEqual({ requirements: [] })
        })

        test('widening the admin level past the regular level is rejected', async () => {
            await testDoubleLevelVisibility.updateAdminLevel({
                implementationParams: pair,
                params: { visibilityId: pair.adminId },
                data: activeIn(groupOne),
                session: Session.empty(),
            })
            await testDoubleLevelVisibility.updateRegularLevel({
                implementationParams: pair,
                params: { visibilityId: pair.regularId },
                data: activeIn(groupOne),
                session: sessionInGroups(groupOne),
            })

            await expect(testDoubleLevelVisibility.updateAdminLevel({
                implementationParams: pair,
                params: { visibilityId: pair.adminId },
                data: activeIn(groupTwo),
                session: sessionInGroups(groupOne),
            })).rejects.toThrow(new Smorekopp('BAD DATA'))

            expect(await readStoredMatrix(pair.adminId)).toEqual(activeIn(groupOne))
        })

        test('setting both levels to the same matrix is allowed', async () => {
            await testDoubleLevelVisibility.updateAdminLevel({
                implementationParams: pair,
                params: { visibilityId: pair.adminId },
                data: activeIn(groupOne),
                session: Session.empty(),
            })
            await testDoubleLevelVisibility.updateRegularLevel({
                implementationParams: pair,
                params: { visibilityId: pair.regularId },
                data: activeIn(groupOne),
                session: sessionInGroups(groupOne),
            })

            expect(await readStoredMatrix(pair.regularId)).toEqual(activeIn(groupOne))
            expect(await readStoredMatrix(pair.adminId)).toEqual(activeIn(groupOne))
        })

        test('an admin level stricter than the regular level is allowed', async () => {
            await arrangeLevels(pair, { regularLevel: activeIn(groupOne) })

            await testDoubleLevelVisibility.updateAdminLevel({
                implementationParams: pair,
                params: { visibilityId: pair.adminId },
                data: {
                    requirements: [
                        { conditions: [{ type: 'ACTIVE', groupId: groupOne }] },
                        { conditions: [{ type: 'ACTIVE', groupId: groupTwo }] },
                    ],
                },
                session: sessionInGroups(groupOne),
            })

            expect((await readStoredMatrix(pair.adminId)).requirements).toHaveLength(2)
        })

        test('widening the regular level is always allowed', async () => {
            await testDoubleLevelVisibility.updateAdminLevel({
                implementationParams: pair,
                params: { visibilityId: pair.adminId },
                data: activeIn(groupOne),
                session: Session.empty(),
            })
            await testDoubleLevelVisibility.updateRegularLevel({
                implementationParams: pair,
                params: { visibilityId: pair.regularId },
                data: activeIn(groupOne),
                session: sessionInGroups(groupOne),
            })

            await testDoubleLevelVisibility.updateRegularLevel({
                implementationParams: pair,
                params: { visibilityId: pair.regularId },
                data: { requirements: [] },
                session: sessionInGroups(groupOne),
            })

            expect(await readStoredMatrix(pair.regularId)).toEqual({ requirements: [] })
        })
    })
})
