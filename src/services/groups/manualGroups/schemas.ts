import { z } from 'zod'

const dataFieldSchemas = z.object({
    name: z.string().max(32).min(1).trim(),
    shortName: z.string().max(32).min(1).trim(),
})

const paramsFieldSchemas = z.object({
    id: z.number(),
})

const manualGroup = dataFieldSchemas.pick({
    name: true,
    shortName: true,
})

const manualGroupId = paramsFieldSchemas.pick({
    id: true,
})

export const manualGroupSchemas = {
    data: {
        create: manualGroup,
        update: manualGroup.partial(),
    },
    params: {
        read: manualGroupId,
        update: manualGroupId,
        destroy: manualGroupId,
    },
}
