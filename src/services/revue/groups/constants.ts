import { articleSectionsRelationsIncluder } from '@/cms/articleSections/constants'
import type { Prisma } from '@/prisma-generated-pn-types'

const groupOrder = { group: { select: { id: true, order: true, pensioned: true } } } as const

/** Its group, which the revue's members of it are the memberships of, through its committee or sub group. */
export const revueGroupKindIncluder = {
    committee: { select: { name: true, shortName: true, ...groupOrder } },
    revueSubGroup: { select: groupOrder },
} as const satisfies Prisma.RevueGroupInclude

export const revueGroupInRevueIncluder = {
    ...revueGroupKindIncluder,
    articleSection: { include: articleSectionsRelationsIncluder },
} as const satisfies Prisma.RevueGroupInclude
