import { expandedImageIncluder } from '@/services/images/subservice/constants'
import type { Prisma } from '@/prisma-generated-pn-types'

export const cmsPersonIncluder = {
    image: { include: expandedImageIncluder },
} as const satisfies Prisma.CmsPersonInclude

export const cmsPersonOrdering = { order: 'asc' } as const satisfies Prisma.CmsPersonOrderByWithRelationInput
