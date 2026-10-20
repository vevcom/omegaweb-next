import { cmsImageIncluder } from '@/cms/images/constants'
import type { Prisma } from '@/prisma-generated-pn-types'

export const productImageIncluder = {
    image: { include: cmsImageIncluder },
} as const satisfies Prisma.ProductInclude
