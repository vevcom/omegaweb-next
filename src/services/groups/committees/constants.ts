import { expandedImageIncluder } from '@/services/images/subservice/constants'
import type { Prisma } from '@/prisma-generated-pn-types'

export const committeeLogoIncluder = {
    logoImage: { include: expandedImageIncluder }
} satisfies Prisma.CommitteeInclude

export const committeeExpandedIncluder = {
    ...committeeLogoIncluder,
    committeeArticle: {
        include: {
            coverImage: {
                include: {
                    image: { include: expandedImageIncluder },
                }
            }
        }
    },
    group: true,
} satisfies Prisma.CommitteeInclude
