import { z } from 'zod'

const dataFieldSchemas = z.object({
    name: z.string().trim().min(1, 'Navnet kan ikke være tomt').max(100, 'Navnet kan ha maks 100 tegn'),
    userId: z.coerce.number().int().positive('Velg en bruker'),
})

const paramsFieldSchemas = z.object({
    groupId: z.number(),
    memberId: z.number(),
})

const userOrDetails = z.discriminatedUnion('type', [
    dataFieldSchemas.pick({ userId: true }).extend({ type: z.literal('USER') }),
    dataFieldSchemas.pick({ name: true }).extend({ type: z.literal('DETAILS') }),
])
const memberId = paramsFieldSchemas.pick({ memberId: true })

export const revueGroupMemberSchemas = {
    data: {
        create: userOrDetails,
        update: userOrDetails,
    },
    params: {
        create: paramsFieldSchemas.pick({ groupId: true }),
        update: memberId,
        destroy: memberId,
    },
}
