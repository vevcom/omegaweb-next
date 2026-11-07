import { articleSectionsRelationsIncluder } from '@/cms/articleSections/constants'
import { userBasicSelection } from '@/services/users/constants'
import type { Prisma } from '@/prisma-generated-pn-types'

export const revueGroupMemberIncluder = {
    user: { select: userBasicSelection },
} as const satisfies Prisma.RevueGroupMemberInclude

export const revueGroupExpandedIncluder = {
    revue: { select: { year: true, name: true } },
    articleSection: { include: articleSectionsRelationsIncluder },
    members: { include: revueGroupMemberIncluder },
} as const satisfies Prisma.RevueGroupInclude
