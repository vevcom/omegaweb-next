import { Zpn } from '@/lib/fields/zpn'
import { z } from 'zod'

/**
 * Exported so services that take a visibility as part of their own input - rather than through
 * visibilityOperations.update - can compose it into their schemas.
 */
export const visibilityRequirementsSchema = z.array(
    z.object({
        conditions: z.array(
            z.object({
                groupId: z.number().int(),
                order: z.number().int().min(0).nullable(),
                onlyActive: z.boolean(),
                onlyAdmins: z.boolean(),
            })
        )
    })
)

const dataFieldSchemas = z.object({
    requirements: Zpn.json({
        label: 'Synlighet',
        schema: visibilityRequirementsSchema,
    }),
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
