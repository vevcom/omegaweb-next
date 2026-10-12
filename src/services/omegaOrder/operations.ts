import '@pn-server-only'
import { omegaOrderAuth } from './auth'
import { groupTypesMigratedStraightAway } from './constants'
import { groupTypesConfig } from '@/services/groups/constants'
import { defineOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import { GroupType } from '@/prisma-generated-pn/client'
import type { OmegaOrderRequirement } from './types'

export const omegaOrderOperations = {
    /**
     * Everything that has to hold before omega may be incremented:
     * - every group of every type has caught up to the current order, and
     * - the classes have been bumped, i.e. no class group other than the graduated one still holds
     *   active memberships from an earlier order.
     *
     * A group type that is migrated straight away on increment is included too: its groups are
     * always brought along, so the requirement only ever fails if something has drifted.
     */
    readRequirements: defineOperation({
        authorizer: () => omegaOrderAuth.readRequirements,
        operation: async ({ prisma }): Promise<OmegaOrderRequirement[]> => {
            const { order } = await omegaOrderOperations.readCurrent({ bypassAuth: true })

            const groupsBehindByType = await prisma.group.groupBy({
                by: ['groupType'],
                where: {
                    order: { lt: order },
                    NOT: {
                        OR: [
                            { committee: { pensioned: true } },
                            { interestGroup: { pensioned: true } },
                            { manualGroup: { pensioned: true } },
                        ],
                    },
                },
                _count: { _all: true },
            })

            const classMembershipsNotBumped = await prisma.membership.count({
                where: {
                    active: true,
                    order: { lt: order },
                    group: {
                        groupType: GroupType.CLASS,
                        class: {
                            level: { not: 'GRADUATED' },
                        },
                    },
                },
            })

            const migrationRequirements = Object.values(GroupType).map(groupType => {
                const behind = groupsBehindByType.find(
                    row => row.groupType === groupType
                )?._count._all ?? 0

                return {
                    key: `GROUPS_MIGRATED_${groupType}`,
                    description:
                        `Alle ${groupTypesConfig[groupType].namePlural.toLowerCase()} er i orden ${order}`,
                    fulfilled: behind === 0,
                    detail: behind === 0 ? undefined : `${behind} gjenstår`,
                } satisfies OmegaOrderRequirement
            })

            return [
                ...migrationRequirements,
                {
                    key: 'CLASSES_BUMPED',
                    description: 'Klassene er rykket opp',
                    fulfilled: classMembershipsNotBumped === 0,
                    detail: classMembershipsNotBumped === 0
                        ? undefined
                        : `${classMembershipsNotBumped} aktive klassemedlemskap fra tidligere ordener`,
                },
            ]
        }
    }),

    /**
     * Increments omega: creates the next order and brings the group types that follow omega
     * automatically along with it. The group types migrated by hand are left where they are - they
     * are migrated one group at a time afterwards, and block the next increment until they have.
     *
     * @throws BAD PARAMETERS if any requirement from `readRequirements` is unfulfilled.
     */
    create: defineOperation({
        opensTransaction: true,
        authorizer: () => omegaOrderAuth.create,
        operation: async ({ prisma }) => {
            const requirements = await omegaOrderOperations.readRequirements({ bypassAuth: true })
            const unfulfilled = requirements.filter(requirement => !requirement.fulfilled)

            if (unfulfilled.length) {
                throw new ServiceError(
                    'BAD PARAMETERS',
                    `Omega kan ikke inkrementeres enda: ${
                        unfulfilled.map(requirement => requirement.description).join(', ')
                    }`
                )
            }

            const { order: oldOrder } = await omegaOrderOperations.readCurrent({ bypassAuth: true })
            const newOrder = oldOrder + 1

            await prisma.$transaction([
                prisma.omegaOrder.create({
                    data: {
                        order: newOrder
                    }
                }),
                prisma.group.updateMany({
                    where: {
                        groupType: { in: groupTypesMigratedStraightAway },
                        order: { lt: newOrder },
                    },
                    data: {
                        order: newOrder
                    }
                }),
            ])
        }
    }),
    readCurrent: defineOperation({
        authorizer: () => omegaOrderAuth.readCurrent,
        operation: async ({ prisma }) => {
            const omegaOrder = await prisma.omegaOrder.findFirst({
                orderBy: {
                    order: 'desc'
                }
            })
            if (!omegaOrder) throw new ServiceError('NOT FOUND', 'Current Omega Order not found')
            return omegaOrder
        }
    }),
    readAll: defineOperation({
        authorizer: () => omegaOrderAuth.readAll,
        operation: async ({ prisma }) =>
            await prisma.omegaOrder.findMany({
                orderBy: {
                    order: 'desc'
                }
            })
    }),
} as const
