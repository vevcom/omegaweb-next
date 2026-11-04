import { expandedImageIncluder } from '@/services/images/subservice/constants'
import type { Prisma } from '@/prisma-generated-pn-types'

export const careersTeamPersonIncluder = {
    image: { include: expandedImageIncluder },
} as const satisfies Prisma.CareerTeamPersonInclude

export const careersTeamPersonOrdering = {
    order: 'asc',
} as const satisfies Prisma.CareerTeamPersonOrderByWithRelationInput
