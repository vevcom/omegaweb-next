import { dateLessThan } from '@/lib/dates/comparison'
import { z } from 'zod'

const fieldSchemas = z.object({
    id: z.number(),
    releaseTime: z.coerce.date(),
    releaseUntil: z.coerce.date(),
})

const releasesBeforeItsEnd = (data: { releaseTime: Date, releaseUntil: Date }) =>
    dateLessThan(data.releaseTime, data.releaseUntil)
const releaseMessage = 'Slipp tiden må være før slutten av perioden som slippes.'

const releasePeriod = fieldSchemas.pick({
    releaseTime: true,
    releaseUntil: true,
}).refine(releasesBeforeItsEnd, releaseMessage)

export const cabinReleasePeriodSchemas = {
    create: releasePeriod,
    update: releasePeriod,
} as const

const releasePeriodId = fieldSchemas.pick({
    id: true,
})

export const cabinReleasePeriodParamsSchemas = {
    destroy: releasePeriodId,
    update: releasePeriodId,
} as const
