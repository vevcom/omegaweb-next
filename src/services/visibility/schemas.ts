import { VisibilityRequirementGroupType } from '@/prisma-generated-pn-types'
import { z } from 'zod'

/**
 * Exported so services that take a visibility as part of their own input - rather than through
 * visibilityOperations.update - can compose it into their schemas.
 */
export const visibilityRequirementsSchema = z.array(
    z.object({
        conditions: z.array(
            z.union([
                z.object({
                    type: z.literal(VisibilityRequirementGroupType.ORDER),
                    order: z.number().min(0),
                    groupId: z.number()
                }),
                z.object({
                    type: z.literal(VisibilityRequirementGroupType.ACTIVE),
                    groupId: z.number()
                })
            ])
        )
    })
)

const dataFieldSchemas = z.object({
    requirements: visibilityRequirementsSchema
})

const paramsFieldSchemas = z.object({
    visibilityId: z.number()
})

const requirements = dataFieldSchemas.pick({
    requirements: true,
})

const visibilityId = paramsFieldSchemas.pick({
    visibilityId: true,
})

export const visibilitySchemas = {
    data: {
        createWithRequirements: requirements,
        update: requirements,
    },
    params: {
        destroy: visibilityId,
        update: visibilityId,
    },
}
