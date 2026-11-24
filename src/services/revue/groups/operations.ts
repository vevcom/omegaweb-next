import '@ow-server-only'
import { revueGroupArticleSection } from './articleSection'
import { revueGroupAuth } from './auth'
import { revueGroupInRevueIncluder, revueGroupKindIncluder } from './constants'
import { revueGroupSchemas } from './schemas'
import { revueSubGroupOperations } from '@/services/groups/revueSubGroups/operations'
import { omegaOrderOperations } from '@/services/omegaOrder/operations'
import { userPartitions } from '@/services/users/constants'
import { defineOperation, defineSubOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import type { Prisma } from '@/prisma-generated-pn-types'
import type { PrismaPossibleTransaction } from '@/services/serviceOperation'

/** Puts a revue group in a revue, with the order whose memberships of its group are the revue's. */
const addToRevue = defineSubOperation({
    paramsSchema: () => revueGroupSchemas.params.addToRevue,
    dataSchema: () => revueGroupSchemas.data.addToRevue,
    operation: () => ({ prisma, params, data }) => prisma.revueGroupInRevue.create({
        data: { revueId: params.revueId, revueGroupId: params.revueGroupId, order: data.order },
    }),
})

export const revueGroupOperations = {
    /** Makes a revue group and puts it in the revue at Omega's current order. */
    create: defineOperation({
        paramsSchema: revueGroupSchemas.params.create,
        dataSchema: revueGroupSchemas.data.create,
        authorizer: () => revueGroupAuth.create,
        transaction: 'OPENS',
        operation: ({ prisma, params, data }) => prisma.$transaction(async tx => {
            const articleSection = await revueGroupArticleSection.internal.create.internalCall({ data: {}, prisma: tx })
            const kind = data.type === 'COMMITTEE'
                ? { committeeId: data.committeeId }
                : { revueSubGroupId: (await revueSubGroupOperations.internal.create.internalCall({ prisma: tx })).id }
            const { order } = await omegaOrderOperations.readCurrent({ prisma: tx, bypassAuth: true })

            const revueGroup = await tx.revueGroup.create({
                data: { name: data.name, type: data.type, ...kind, articleSectionId: articleSection.id },
            })
            await addToRevue.internalCall({
                prisma: tx,
                params: { revueId: params.revueId, revueGroupId: revueGroup.id },
                data: { order },
            })
            return revueGroup
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
                group: { id: group.id, order: group.order },
                committee: revueGroup.committee && {
                    name: revueGroup.committee.name,
                    shortName: revueGroup.committee.shortName,
                },
                members: await readMembersInRevue(prisma, group, order),
            }
        },
    }),

    update: defineOperation({
        paramsSchema: revueGroupSchemas.params.update,
        dataSchema: revueGroupSchemas.data.update,
        authorizer: () => revueGroupAuth.update,
        operation: ({ prisma, params, data }) => prisma.revueGroup.update({
            where: { id: params.revueGroupId },
            data,
        }),
    }),

    /** A sub group goes with its revue group, its memberships too. A committee is never touched. */
    destroy: defineOperation({
        paramsSchema: revueGroupSchemas.params.destroy,
        authorizer: () => revueGroupAuth.destroy,
        transaction: 'OPENS',
        operation: ({ prisma, params }) => prisma.$transaction(async tx => {
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
        addToRevue,
    },
} as const

type GroupAndOrder = { id: number, order: number, pensioned: boolean }

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

async function readMembersInRevue(prisma: PrismaPossibleTransaction<false>, group: GroupAndOrder, order: number) {
    const memberships = await prisma.membership.findMany({
        where: membershipsInRevue(group, order),
        select: { title: true, user: { select: { firstname: true, lastname: true } } },
        orderBy: [{ position: 'asc' }, { userId: 'asc' }],
    })
    return memberships.map(({ title, user }) => ({ name: `${user.firstname} ${user.lastname}`, title }))
}
