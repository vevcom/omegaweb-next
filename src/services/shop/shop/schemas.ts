import { z } from 'zod'

const baseSchema = z.object({
    name: z.string().min(3),
    description: z.string(),
})

export const shopSchemas = {
    create: baseSchema.pick({
        name: true,
        description: true,
    })
}
