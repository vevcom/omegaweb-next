import { expandedImageIncluder } from '@/services/images/subservice/constants'
import type { Prisma } from '@/prisma-generated-pn-types'

export const committeesParticipatingIncluder = {
    committeesParticipating: {
        include: {
            paragraph: true,
            videoLink: true,
            committee: {
                include: {
                    logoImage: { include: expandedImageIncluder },
                }
            }
        }
    }
} as const satisfies Prisma.ApplicationPeriodInclude
