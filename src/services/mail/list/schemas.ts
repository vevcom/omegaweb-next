import { mailOwnerRequirements } from '@/services/mail/schemas'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    name: z.string().min(2).max(50),
    description: z.string().max(200),
    ownerRequirements: mailOwnerRequirements,
})

const paramsFieldSchemas = z.object({
    id: z.coerce.number().min(1),
})

const mailingList = paramsFieldSchemas.pick({
    id: true,
})

export const mailingListSchemas = {
    data: {
        create: dataFieldSchemas.pick({
            name: true,
            description: true,
            ownerRequirements: true,
        }),
        update: dataFieldSchemas.pick({
            name: true,
            description: true,
        }),
    },
    params: {
        update: mailingList,
        visibility: mailingList,
        destroy: mailingList,
    },
}
