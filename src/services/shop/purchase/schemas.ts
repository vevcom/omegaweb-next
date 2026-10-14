import { userDataFieldSchemas } from '@/services/users/schemas'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    shopId: z.coerce.number().int(),
    studentCard: userDataFieldSchemas.shape.studentCard,
    products: z.array(z.object({
        id: z.number().int(),
        quantity: z.number().int().min(1)
    })),
})

export const purchaseSchemas = {
    data: {
        createByStudentCard: dataFieldSchemas.pick({
            shopId: true,
            products: true,
            studentCard: true,
        }),
    },
}
