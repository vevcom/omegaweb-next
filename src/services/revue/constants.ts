import { articleRelationsIncluder } from '@/cms/articles/constants'
import { cmsImageIncluder } from '@/cms/images/constants'
import type { Prisma } from '@/prisma-generated-pn-types'

export const revueCardIncluder = {
    article: { select: { coverImage: { include: cmsImageIncluder } } },
} as const satisfies Prisma.RevueInclude

export const revueExpandedIncluder = {
    article: { include: articleRelationsIncluder },
    groups: { select: { id: true, name: true }, orderBy: { name: 'asc' } },
} as const satisfies Prisma.RevueInclude
