import '@ow-server-only'
import { visibilitySchemas } from './schemas'
import { conditionKey } from './conditionKey'
import { defineSubOperation } from '@/services/serviceOperation'
import type { visibilityRequirementsSchema } from './schemas'
import type { VisibilityCondition } from './types'
import type { z } from 'zod'

export const visibilityOperations = {
    create: defineSubOperation({
        read: false,
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
        read: false,
        operation: () => ({ prisma, data }) =>
            prisma.visibility.create({
                data: {
                    requirements: { create: buildRequirementsCreateInput(data.requirements) }
                }
            })
    }),

    destroy: defineSubOperation({
        paramsSchema: () => visibilitySchemas.params.destroy,
        read: false,
        operation: () => ({ prisma, params }) =>
            prisma.visibility.delete({ where: { id: params.visibilityId } })
    }),

    /**
     * Makes the requirements of a visibility the ones given. Requirements that are the same as the
     * stored ones are left as they are, so that saving something else along with them writes nothing here.
     */
    update: defineSubOperation({
        paramsSchema: () => visibilitySchemas.params.update,
        dataSchema: () => visibilitySchemas.data.update,
        transaction: 'RUNS_IN',
        read: false,
        operation: () => async ({ prisma, params, data }) => {
            const { requirements: stored, ...visibility } = await prisma.visibility.findUniqueOrThrow({
                where: { id: params.visibilityId },
                include: { requirements: { include: { conditions: true } } },
            })
            if (sameRequirements(stored, data.requirements)) return visibility

            // The conditions go with their requirement by cascade.
            await prisma.visibilityRequirement.deleteMany({ where: { visibilityId: params.visibilityId } })
            return await prisma.visibility.update({
                where: { id: params.visibilityId },
                data: { requirements: { create: buildRequirementsCreateInput(data.requirements) } },
            })
        }
    }),
} as const

/**
 * Drops conditions that say the same, so that a requirement listing the same group twice does not
 * collide on the unique indexes of a requirement's conditions.
 */
function dedupeConditions(conditions: VisibilityCondition[]): VisibilityCondition[] {
    return Array.from(new Map(conditions.map(condition => [conditionKey(condition), condition])).values())
}

/** Shared by update and createWithRequirements so the two cannot drift apart. */
function buildRequirementsCreateInput(requirements: z.infer<typeof visibilityRequirementsSchema>) {
    return requirements.map(requirement => ({
        conditions: {
            create: dedupeConditions(requirement.conditions).map(({ groupId, order, onlyActive, onlyAdmins }) => ({
                groupId,
                order,
                onlyActive,
                onlyAdmins,
            }))
        }
    }))
}

/** Whether the requirements given are the ones stored, whatever order they and their conditions come in. */
function sameRequirements(
    stored: { conditions: VisibilityCondition[] }[],
    given: z.infer<typeof visibilityRequirementsSchema>,
) {
    const keysOf = (requirements: { conditions: VisibilityCondition[] }[]) => requirements
        .map(requirement => Array.from(new Set(requirement.conditions.map(conditionKey))).sort().join(','))
        .sort()
    const storedKeys = keysOf(stored)
    const givenKeys = keysOf(given)
    return storedKeys.length === givenKeys.length && storedKeys.every((key, index) => key === givenKeys[index])
}
