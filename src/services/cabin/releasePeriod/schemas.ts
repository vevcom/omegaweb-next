import { dateLessThan } from '@/lib/dates/comparison'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    releaseTime: z.coerce.date(),
    releaseUntil: z.coerce.date(),
})

const paramsFieldSchemas = z.object({
    id: z.number(),
})

const releasesBeforeItsEnd = (data: { releaseTime: Date, releaseUntil: Date }) =>
    dateLessThan(data.releaseTime, data.releaseUntil)
const releaseMessage = 'Slipp tiden må være før slutten av perioden som slippes.'

const releasePeriod = dataFieldSchemas.pick({
    releaseTime: true,
    releaseUntil: true,
}).refine(releasesBeforeItsEnd, releaseMessage)

const releasePeriodId = paramsFieldSchemas.pick({
    id: true,
})

export const cabinReleasePeriodSchemas = {
    data: {
        create: releasePeriod,
        update: releasePeriod,
    },
    params: {
        destroy: releasePeriodId,
        update: releasePeriodId,
    },
}
