import '@ow-server-only'
import { revueGroupArticleSection } from './articleSection'
import { revueGroupAuth } from './auth'
import { revueGroupInRevueIncluder, revueGroupKindIncluder } from './constants'
import { revueGroupSchemas } from './schemas'
import { revueSubGroupOperations } from '@/services/groups/revueSubGroups/operations'
import { omegaOrderOperations } from '@/services/omegaOrder/operations'
import { userPartitions } from '@/services/users/constants'
import { assertGroupNotPensioned } from '@/services/groups/groupChecks'
import { defineOperation, defineSubOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import type { Prisma } from '@/prisma-generated-pn-types'
import type { PrismaPossibleTransaction } from '@/services/serviceOperation'

/** Puts a revue group in a revue, with the order whose memberships of its group are the revue's. */
const addToRevue = defineSubOperation({
    paramsSchema: () => revueGroupSchemas.params.addToRevue,
    dataSchema: () => revueGroupSchemas.data.addToRevue,
    operation: () => async ({ prisma, params, data }) => {
        if (!await prisma.omegaOrder.findUnique({ where: { order: data.order } })) {
            throw new ServiceError('BAD DATA', `Omega har ingen orden ${data.order}`)
        }
        return prisma.revueGroupInRevue.create({
            data: { revueId: params.revueId, revueGroupId: data.revueGroupId, order: data.order },
        })
    },
})

/**
 * Carries the previous revue's groups into a new one, in the new revue's transaction, once Omega has passed the
 * previous revue's order. A committee is put in at its order in the previous revue plus one and nothing else. A
 * sub group is put in at Omega's current order, migrated there with the members kept for it unless it stands
 * there already, and a sub group left out is pensioned.
 */
const carryInto = defineSubOperation({
    paramsSchema: () => revueGroupSchemas.params.carryInto,
    dataSchema: () => revueGroupSchemas.data.carryInto,
    operation: () => async ({ prisma, params, data }) => {
        const revue = await prisma.revue.findUniqueOrThrow({ where: { id: params.revueId }, select: { year: true } })
        const previous = await readPreviousRevue(prisma, { exceptRevueId: params.revueId })
        const carriable = previous ? carriableGroups(previous) : []
        const keepOf = new Map(data.carriedGroups.map(carried => [carried.revueGroupId, carried.keep]))
        const carriableIds = carriable.map(({ revueGroup }) => revueGroup.id)
        if (data.carriedGroups.some(carried => !carriableIds.includes(carried.revueGroupId))) {
            throw new ServiceError('BAD DATA', 'Bare grupper i forrige revy som ikke er pensjonert kan tas med')
        }
        if (!previous || !carriable.length) return
        if (revue.year <= previous.year) {
            throw new ServiceError(
                'BAD DATA',
                `Gruppene kan bare tas med til en revy etter ${previous.name} (${previous.year})`,
            )
        }
        const { order: currentOrder } = await omegaOrderOperations.readCurrent({ prisma, bypassAuth: true })
        if (currentOrder <= orderOf(previous)) {
            throw new ServiceError('BAD DATA', omegaHasNotIncrementedText(previous))
        }

        for (const { revueGroup, order } of carriable) {
            const keep = keepOf.get(revueGroup.id)
            const group = revueGroup.revueSubGroup?.group
            const revueGroupId = revueGroup.id
            if (!group) {
                if (keep) await addToRevue.internalCall({ prisma, params, data: { revueGroupId, order: order + 1 } })
                continue
            }
            if (!keep) {
                await revueSubGroupOperations.pension({ prisma, params: { groupId: group.id }, data: { pensioned: true } })
                continue
            }
            if (group.order < currentOrder) await migrateWithItsName(prisma, revueGroup.name, group.id, keep)
            await addToRevue.internalCall({ prisma, params, data: { revueGroupId, order: currentOrder } })
        }
    },
})

export const revueGroupOperations = {
    /** Makes a revue group, and puts it in the revue at Omega's current order when a revue is given. */
    create: defineOperation({
        paramsSchema: revueGroupSchemas.params.create,
        dataSchema: revueGroupSchemas.data.create,
        authorizer: () => revueGroupAuth.create,
        transaction: 'OPENS',
        operation: ({ prisma, params: { revueId }, data }) => prisma.$transaction(async tx => {
            if (data.type === 'COMMITTEE') await assertNotARevueGroupYet(tx, data.committeeId)
            const articleSection = await revueGroupArticleSection.internal.create.internalCall({ data: {}, prisma: tx })
            const kind = data.type === 'COMMITTEE'
                ? { committeeId: data.committeeId }
                : { revueSubGroupId: (await revueSubGroupOperations.internal.create.internalCall({ prisma: tx })).id }

            const revueGroup = await tx.revueGroup.create({
                data: { name: data.name, type: data.type, ...kind, articleSectionId: articleSection.id },
            })
            if (revueId !== undefined) {
                const { order } = await omegaOrderOperations.readCurrent({ prisma: tx, bypassAuth: true })
                await addToRevue.internalCall({
                    prisma: tx,
                    params: { revueId },
                    data: { revueGroupId: revueGroup.id, order },
                })
            }
            return revueGroup
        }),
    }),

    addToRevue: addToRevue.implement({
        authorizer: () => revueGroupAuth.addToRevue,
        ownershipCheck: () => true,
    }),

    removeFromRevue: defineOperation({
        paramsSchema: revueGroupSchemas.params.removeFromRevue,
        authorizer: () => revueGroupAuth.removeFromRevue,
        operation: ({ prisma, params }) => prisma.revueGroupInRevue.delete({
            where: { revueId_revueGroupId: params },
        }),
    }),

    /**
     * The groups the next revue may carry over from the previous one, the newest: each with the order it would
     * have in the new revue, and for a sub group to be migrated the active members it may take along.
     */
    readToCarryOver: defineOperation({
        authorizer: () => revueGroupAuth.readToCarryOver,
        operation: async ({ prisma }) => {
            const previous = await readPreviousRevue(prisma, {})
            const { order: currentOrder } = await omegaOrderOperations.readCurrent({ bypassAuth: true })
            if (!previous) return null

            return {
                previousRevue: { year: previous.year, name: previous.name },
                omegaHasNotIncremented: currentOrder <= orderOf(previous) ? omegaHasNotIncrementedText(previous) : null,
                groups: await Promise.all(carriableGroups(previous).map(async ({ revueGroup, order }) => {
                    const group = revueGroup.revueSubGroup?.group
                    return {
                        id: revueGroup.id,
                        name: revueGroup.name,
                        type: revueGroup.type,
                        order,
                        orderInNewRevue: group ? currentOrder : order + 1,
                        migration: group && group.order < currentOrder ? {
                            groupId: group.id,
                            groupOrder: group.order,
                            candidates: await readMigrationCandidates(prisma, group),
                        } : null,
                    }
                })),
            }
        },
    }),

    readMany: defineOperation({
        authorizer: () => revueGroupAuth.readMany,
        operation: ({ prisma }) => prisma.revueGroup.findMany({
            include: revueGroupKindIncluder,
            orderBy: { name: 'asc' },
        }),
    }),

    /** A group with the revues it is in, for its admin page. */
    read: defineOperation({
        paramsSchema: revueGroupSchemas.params.read,
        authorizer: () => revueGroupAuth.read,
        operation: ({ prisma, params }) => prisma.revueGroup.findUniqueOrThrow({
            where: { name: params.name },
            include: {
                ...revueGroupKindIncluder,
                revues: {
                    select: { order: true, revue: { select: { year: true, name: true } } },
                    orderBy: { revue: { year: 'desc' } },
                },
            },
        }),
    }),

    readManyInRevue: defineOperation({
        paramsSchema: revueGroupSchemas.params.readManyInRevue,
        authorizer: () => revueGroupAuth.readManyInRevue,
        operation: async ({ prisma, params }) => {
            const groupsInRevue = await prisma.revueGroupInRevue.findMany({
                where: { revueId: params.revueId },
                include: { revueGroup: { include: revueGroupKindIncluder } },
                orderBy: { revueGroup: { name: 'asc' } },
            })

            return Promise.all(groupsInRevue.map(async ({ revueGroup, order }) => ({
                id: revueGroup.id,
                name: revueGroup.name,
                type: revueGroup.type,
                order,
                memberCount: await prisma.membership.count({
                    where: membershipsInRevue(groupOfRevueGroup(revueGroup), order),
                }),
            })))
        },
    }),

    /** A group as a revue shows it, with its members of that revue as names and titles alone. */
    readInRevue: defineOperation({
        paramsSchema: revueGroupSchemas.params.readInRevue,
        authorizer: () => revueGroupAuth.readInRevue,
        operation: async ({ prisma, params }) => {
            const { revue, revueGroup, order } = await prisma.revueGroupInRevue.findFirstOrThrow({
                where: { revue: { year: params.year }, revueGroup: { name: params.name } },
                include: {
                    revue: { select: { id: true, year: true, name: true } },
                    revueGroup: { include: revueGroupInRevueIncluder },
                },
            })
            const group = groupOfRevueGroup(revueGroup)

            return {
                id: revueGroup.id,
                name: revueGroup.name,
                type: revueGroup.type,
                articleSection: revueGroup.articleSection,
                revue,
                order,
                group,
                committee: revueGroup.committee && {
                    name: revueGroup.committee.name,
                    shortName: revueGroup.committee.shortName,
                },
                members: (await readMembersInRevue(prisma, group, order)).map(({ name, title }) => ({ name, title })),
            }
        },
    }),

    update: defineOperation({
        paramsSchema: revueGroupSchemas.params.update,
        dataSchema: revueGroupSchemas.data.update,
        authorizer: () => revueGroupAuth.update,
        operation: async ({ prisma, params, data }) => {
            await assertSubGroupNotPensioned(prisma, params.revueGroupId)
            return prisma.revueGroup.update({ where: { id: params.revueGroupId }, data })
        },
    }),

    /** A sub group goes with its revue group, its memberships too. A committee is never touched. */
    destroy: defineOperation({
        paramsSchema: revueGroupSchemas.params.destroy,
        authorizer: () => revueGroupAuth.destroy,
        transaction: 'OPENS',
        operation: ({ prisma, params }) => prisma.$transaction(async tx => {
            await assertSubGroupNotPensioned(tx, params.revueGroupId)
            const revueGroup = await tx.revueGroup.delete({ where: { id: params.revueGroupId } })
            await revueGroupArticleSection.internal.destroy.internalCall({
                prisma: tx,
                params: { articleSectionId: revueGroup.articleSectionId },
            })
            if (revueGroup.revueSubGroupId !== null) {
                await revueSubGroupOperations.internal.destroy.internalCall({
                    prisma: tx,
                    params: { id: revueGroup.revueSubGroupId },
                })
            }
        }),
    }),

    articleSection: revueGroupArticleSection,

    internal: {
        carryInto,
    },

    /**
     * The revue groups a user was in, one for each revue a group was in, with the order their membership
     * is of. Newest revue first. A user is in a group in a revue by the same rule as its members there.
     */
    readManyOfUser: defineOperation({
        paramsSchema: revueGroupSchemas.params.readManyOfUser,
        authorizer: ({ params }) => revueGroupAuth.readManyOfUser.data({ userId: params.userId }),
        operation: async ({ prisma, params }) => {
            const memberOfGroup = { group: { memberships: { some: { userId: params.userId } } } }
            const groupsInRevues = await prisma.revueGroupInRevue.findMany({
                where: { revueGroup: { OR: [{ committee: memberOfGroup }, { revueSubGroup: memberOfGroup }] } },
                include: {
                    revue: { select: { year: true, name: true } },
                    revueGroup: { include: revueGroupKindIncluder },
                },
                orderBy: [{ revue: { year: 'desc' } }, { revueGroup: { name: 'asc' } }],
            })

            const groups = groupsInRevues.map(({ revueGroup, order }) => ({ group: groupOfRevueGroup(revueGroup), order }))
            const memberships = await prisma.membership.findMany({
                where: { userId: params.userId, OR: groups.map(({ group, order }) => membershipsInRevue(group, order)) },
                select: { groupId: true, order: true, title: true },
            })

            return groupsInRevues.flatMap(({ revue, revueGroup, order }, index) => {
                const membership = memberships.find(candidate => (
                    candidate.groupId === groups[index].group.id && candidate.order === order
                ))
                if (!membership) return []
                return [{ revue, name: revueGroup.name, type: revueGroup.type, order, title: membership.title }]
            })
        },
    }),

    /** A group's members in a revue as `readInRevue` gives them, with the username that opens each profile. */
    readMemberProfilesInRevue: defineOperation({
        paramsSchema: revueGroupSchemas.params.readMemberProfilesInRevue,
        authorizer: () => revueGroupAuth.readMemberProfilesInRevue,
        operation: async ({ prisma, params }) => {
            const { revueGroup, order } = await prisma.revueGroupInRevue.findFirstOrThrow({
                where: { revue: { year: params.year }, revueGroup: { name: params.name } },
                include: { revueGroup: { include: revueGroupKindIncluder } },
            })
            return readMembersInRevue(prisma, groupOfRevueGroup(revueGroup), order)
        },
    }),
} as const

type GroupAndOrder = { id: number, order: number, pensioned: boolean }

/** The revue with the highest year, which is the one a new revue carries groups over from. */
function readPreviousRevue(prisma: PrismaPossibleTransaction<false>, { exceptRevueId }: { exceptRevueId?: number }) {
    return prisma.revue.findFirst({
        where: { id: { not: exceptRevueId } },
        orderBy: { year: 'desc' },
        select: {
            year: true,
            name: true,
            groups: {
                include: { revueGroup: { include: revueGroupKindIncluder } },
                orderBy: { revueGroup: { name: 'asc' } },
            },
        },
    })
}

type PreviousRevue = NonNullable<Awaited<ReturnType<typeof readPreviousRevue>>>

/** A pensioned sub group is not carried, since it may not change. */
function carriableGroups(previous: PreviousRevue) {
    return previous.groups.filter(({ revueGroup }) => !revueGroup.revueSubGroup?.group.pensioned)
}

/**
 * The order the previous revue stood in, which Omega must have passed before its groups are carried on. It stands
 * in, a little strictly, for the rule that no group sits at the same order in two revues after one another.
 */
function orderOf(previous: PreviousRevue) {
    return Math.max(...previous.groups.map(({ order }) => order))
}

function omegaHasNotIncrementedText(previous: PreviousRevue) {
    return `Omega har ikke inkrementert siden ${previous.name} (orden ${orderOf(previous)}). `
        + 'Gruppene kan tas med når Omega har inkrementert.'
}

async function readMigrationCandidates(prisma: PrismaPossibleTransaction<false>, group: GroupAndOrder) {
    const memberships = await prisma.membership.findMany({
        where: { groupId: group.id, order: group.order, active: true, user: userPartitions.unarchived },
        select: { userId: true, title: true, admin: true, user: { select: { firstname: true, lastname: true } } },
        orderBy: [{ position: 'asc' }, { userId: 'asc' }],
    })
    return memberships.map(({ user, ...membership }) => ({ ...membership, name: `${user.firstname} ${user.lastname}` }))
}

/** A migration the group system refuses says which group it is about, since a new revue migrates several. */
async function migrateWithItsName(
    prisma: PrismaPossibleTransaction<false>,
    name: string,
    groupId: number,
    keep: { userId: number, admin: boolean }[],
) {
    try {
        await revueSubGroupOperations.migrateGroup({ prisma, params: { groupId }, data: { keep } })
    } catch (error) {
        if (!(error instanceof ServiceError)) throw error
        throw new ServiceError(error.errorCode, `${name}: ${error.errors.map(({ message }) => message).join(', ')}`)
    }
}

/** A pensioned sub group is not changed, as no group of the group system is. A committee's pension is its own. */
async function assertSubGroupNotPensioned(prisma: PrismaPossibleTransaction<false>, revueGroupId: number) {
    const { revueSubGroup } = await prisma.revueGroup.findUniqueOrThrow({
        where: { id: revueGroupId },
        select: { revueSubGroup: { select: { groupId: true } } },
    })
    if (revueSubGroup) await assertGroupNotPensioned(prisma, revueSubGroup.groupId)
}

/** A committee is one revue group at most, which the unique column holds and this says in words. */
async function assertNotARevueGroupYet(prisma: PrismaPossibleTransaction<false>, committeeId: number) {
    const committee = await prisma.committee.findUniqueOrThrow({
        where: { id: committeeId },
        select: { name: true, revueGroup: { select: { name: true } } },
    })
    if (committee.revueGroup) {
        throw new ServiceError('DUPLICATE', `${committee.name} er allerede revygruppen ${committee.revueGroup.name}`)
    }
}

function groupOfRevueGroup(revueGroup: {
    committee: { group: GroupAndOrder } | null,
    revueSubGroup: { group: GroupAndOrder } | null,
}): GroupAndOrder {
    const group = revueGroup.committee?.group ?? revueGroup.revueSubGroup?.group
    if (!group) throw new ServiceError('SERVER ERROR', 'Revygruppen har verken komité eller undergruppe')
    return group
}

/**
 * The memberships of the group that are a revue's members of it, those of the order the group is in the
 * revue with: the active ones while the group stands in that order, and every one once it has moved past
 * it or been pensioned in it. A group has no memberships of an order it has not reached, so before that
 * there are none.
 */
function membershipsInRevue(group: GroupAndOrder, order: number): Prisma.MembershipWhereInput {
    return {
        groupId: group.id,
        order,
        user: userPartitions.unarchived,
        ...(group.order === order && !group.pensioned && { active: true }),
    }
}

/** The revue's members of the group, in the group's own order of them, with the username a profile needs. */
async function readMembersInRevue(prisma: PrismaPossibleTransaction<false>, group: GroupAndOrder, order: number) {
    const memberships = await prisma.membership.findMany({
        where: membershipsInRevue(group, order),
        select: { title: true, user: { select: { firstname: true, lastname: true, username: true } } },
        orderBy: [{ position: 'asc' }, { userId: 'asc' }],
    })
    return memberships.map(({ title, user }) => ({
        name: `${user.firstname} ${user.lastname}`,
        title,
        username: user.username,
    }))
}
