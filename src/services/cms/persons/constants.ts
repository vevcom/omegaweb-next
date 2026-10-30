import { cmsImageIncluder } from '@/cms/images/constants'
import type { Prisma } from '@/prisma-generated-pn-types'

export const cmsPersonIncluder = {
    cmsImage: { include: cmsImageIncluder },
} as const satisfies Prisma.CmsPersonInclude

export const cmsPersonOrdering = { order: 'asc' } as const satisfies Prisma.CmsPersonOrderByWithRelationInput
