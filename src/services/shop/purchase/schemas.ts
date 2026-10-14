import { userDataFieldSchemas } from '@/services/users/schemas'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    shopId: z.coerce.number().int(),
    studentCard: userDataFieldSchemas.shape.studentCard,
    products: z.array(z.object({
        id: z.number().int(),
        quantity: z.number().int().min(1),
    })).min(1, 'Du må velge minst ett produkt.'),
})

const paramsFieldSchemas = z.object({
    userId: z.number(),
})

/** What is bought, and where. */
const order = dataFieldSchemas.pick({
    shopId: true,
    products: true,
})

const buyer = paramsFieldSchemas.pick({
    userId: true,
})

export const purchaseSchemas = {
    data: {
        create: order,
        createOnBehalf: order,
        createByStudentCard: dataFieldSchemas.pick({
            shopId: true,
            products: true,
            studentCard: true,
        }),
    },
    params: {
        create: buyer,
        createOnBehalf: buyer,
    },
}
