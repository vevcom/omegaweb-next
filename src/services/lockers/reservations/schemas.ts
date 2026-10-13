import { z } from 'zod'

const dataFieldSchemas = z.object({
    groupId: z.string(),
    indefiniteDate: z.string().optional(),
    endDate: z.string().optional(),
})

const paramsFieldSchemas = z.object({
    id: z.number(),
    lockerId: z.number(),
})

const reservation = dataFieldSchemas.pick({
    groupId: true,
    indefiniteDate: true,
    endDate: true,
}).transform(data => ({
    groupId: data.groupId === 'null' ? null : parseInt(data.groupId, 10),
    indefiniteDate: data.indefiniteDate ? data.indefiniteDate === 'on' : false,
    endDate: data.endDate ? (new Date(data.endDate)) : null
}))

const reservationId = paramsFieldSchemas.pick({
    id: true,
})

export const lockerReservationSchemas = {
    data: {
        create: reservation,
        update: reservation,
    },
    params: {
        create: paramsFieldSchemas.pick({
            lockerId: true,
        }),
        read: reservationId,
        update: reservationId,
    },
}
