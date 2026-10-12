import { expandedImageIncluder } from '@/services/images/subservice/constants'
import type { Prisma } from '@/prisma-generated-pn-types'

export const maxImageSize = 540
export const minImageSize = 130
export const imageSizeIncrement = 20

export const articleSectionsRelationsIncluder = {
    cmsImage: {
        include: {
            image: { include: expandedImageIncluder }
        }
    },
    cmsParagraph: true,
    cmsLink: true,
} as const satisfies Prisma.ArticleSectionInclude
