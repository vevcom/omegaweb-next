import { expandedImageIncluder } from '@/services/images/subservice/constants'
import type { Prisma } from '@/prisma-generated-pn-types'

export const cmsImageIncluder = {
    image: { include: expandedImageIncluder },
} as const satisfies Prisma.CmsImageInclude
