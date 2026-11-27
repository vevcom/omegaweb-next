import { z } from 'zod'

export const lockerLocationDataFieldSchemas = z.object({
    building: z.string().trim().min(1),
    floor: z.number({ required_error: 'Etasje må fylles ut' }).int('Etasje må være et heltall'),
})

export const lockerLocationParamsFieldSchemas = z.object({
    id: z.number(),
})
