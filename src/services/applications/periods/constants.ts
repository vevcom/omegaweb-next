import { expandedImageIncluder } from '@/services/images/subservice/constants'
import type { Prisma } from '@/prisma-generated-pn-types'

export const committeesParticipatingIncluder = {
    committeesParticipating: {
        include: {
            committee: {
                include: {
                    logoImage: { include: expandedImageIncluder },
                    paragraph: true
                }
            }
        }
    }
} as const satisfies Prisma.ApplicationPeriodInclude
