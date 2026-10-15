import { expandedImageIncluder } from '@/services/images/subservice/constants'
import type { Prisma } from '@/prisma-generated-pn-types'

const ombulFileSizeMb = 10
export const maxOmbulFileSize = ombulFileSizeMb * 1024 * 1024

export const expandedOmbulIncluder = {
    coverImage: { include: expandedImageIncluder },
    paragraph: true,
} as const satisfies Prisma.OmbulInclude

/** Newest first: by year, then by issue within the year. */
export const ombulOrderBy: Prisma.OmbulOrderByWithRelationInput[] = [
    { year: 'desc' },
    { issueNumber: 'desc' },
]
