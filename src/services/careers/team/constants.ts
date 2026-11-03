import { careersTeamPersonIncluder, careersTeamPersonOrdering } from './persons/constants'
import type { Prisma } from '@/prisma-generated-pn-types'

export const careersTeamDepartmentIncluder = {
    paragraph: true,
    persons: {
        include: careersTeamPersonIncluder,
        orderBy: careersTeamPersonOrdering,
    },
} as const satisfies Prisma.CareerTeamDepartmentInclude
