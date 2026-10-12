import { z } from 'zod'

const fieldSchemas = z.object({
    name: z.string().min(3),
    description: z.string(),
})

export const shopSchemas = {
    create: fieldSchemas.pick({
        name: true,
        description: true,
    })
}
