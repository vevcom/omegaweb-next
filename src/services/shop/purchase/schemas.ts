import { studentCardSchema } from '@/services/users/schemas'
import { z } from 'zod'

const productSchema = z.array(z.object({
    id: z.number().int(),
    quantity: z.number().int().min(1)
}))

const baseSchema = z.object({
    shopId: z.coerce.number().int(),
    studentCard: studentCardSchema,
    products: productSchema,
})

export const purchaseSchemas = {
    create: baseSchema.pick({
        shopId: true,
        products: true,
    }),
    createByStudentCard: baseSchema.pick({
        shopId: true,
        products: true,
        studentCard: true,
    })
}
