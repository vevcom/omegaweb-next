import type { cabinProductPriceIncluder } from './constants'
import type { Prisma } from '@/prisma-generated-pn-types'

export type CabinProductExtended = Prisma.CabinProductGetPayload<{
    include: typeof cabinProductPriceIncluder
}>

export type CabinProductPriceExtended = Prisma.CabinProductPriceGetPayload<{
    include: typeof cabinProductPriceIncluder.CabinProductPrice.include
}>
