import '@pn-server-only'
import { visibilitySchemas } from './schemas'
import { defineSubOperation } from '@/services/serviceOperation'
import { omegaOrderOperations } from '@/services/omegaOrder/operations'
import type { visibilityRequirementsSchema } from './schemas'
import type { VisibilityRequirementGroupType } from '@/prisma-generated-pn-types'
import type { z } from 'zod'

/**
 * A condition as stored: unlike `VisibilityCondition` in types.ts, every row has an order, the
 * current one for an ACTIVE condition.
 */
type VisibilityConditionRow = {
    groupId: number,
    type: VisibilityRequirementGroupType,
    order: number,
}

/**
 * Drops conditions that are identical in every field, so that a requirement listing the same group
 * twice does not collide on @@unique([visibilityRequirementId, groupId, order]).
 *
 * Note this cannot remove every possible collision: an ACTIVE and an ORDER condition on the same
 * group resolve to the same (groupId, order) row when the order is the current one, yet mean
 * different things to checkVisibility. Those still hit the unique index and roll the transaction
 * back, which is the safe outcome.
 */
function dedupeConditions(conditions: VisibilityConditionRow[]): VisibilityConditionRow[] {
    const seen = new Map<string, VisibilityConditionRow>()
    conditions.forEach(condition => {
        seen.set(`${condition.groupId}-${condition.type}-${condition.order}`, condition)
    })
    return Array.from(seen.values())
}

/**
 * Resolves a visibility matrix into prisma nested-create input. ACTIVE conditions carry no order of
 * their own, so they are pinned to the current omega order. Shared by update and
 * createWithRequirements so the two cannot drift apart on that resolution.
 */
async function buildRequirementsCreateInput(requirements: z.infer<typeof visibilityRequirementsSchema>) {
    const currentOrder = await omegaOrderOperations.readCurrent({ bypassAuth: true })

    return requirements.map(requirement => ({
        conditions: {
            create: dedupeConditions(requirement.conditions.map(condition => ({
                groupId: condition.groupId,
                type: condition.type,
                order: condition.type === 'ORDER' ? condition.order : currentOrder.order
            })))
        }
    }))
}

export const visibilityOperations = {
    create: defineSubOperation({
        operation: () => ({ prisma }) =>
            prisma.visibility.create({ data: {} })
    }),

    /**
     * Creates a visibility that is restricted from the start. Prefer this over create when the
     * caller already knows the requirements: a visibility with no requirements is vacuously true in
     * checkVisibility, so anything created empty is open to everyone until it is updated.
     */
    createWithRequirements: defineSubOperation({
        dataSchema: () => visibilitySchemas.data.createWithRequirements,
        operation: () => async ({ prisma, data }) =>
            prisma.visibility.create({
                data: {
                    requirements: { create: await buildRequirementsCreateInput(data.requirements) }
                }
            })
    }),

    destroy: defineSubOperation({
        paramsSchema: () => visibilitySchemas.params.destroy,
        operation: () => ({ prisma, params }) =>
            prisma.visibility.delete({ where: { id: params.visibilityId } })
    }),

    update: defineSubOperation({
        paramsSchema: () => visibilitySchemas.params.update,
        dataSchema: () => visibilitySchemas.data.update,
        opensTransaction: true,
        operation: () => async ({ prisma, params, data }) => {
            const requirements = await buildRequirementsCreateInput(data.requirements)

            return await prisma.$transaction(async (tx) => {
                //Remove all current visibilityRequirements (and by cascade all visibilityRequirementGroups)
                await tx.visibilityRequirement.deleteMany({
                    where: { visibilityId: params.visibilityId }
                })

                return await tx.visibility.update({
                    where: { id: params.visibilityId },
                    data: { requirements: { create: requirements } }
                })
            })
        }
    })
} as const
