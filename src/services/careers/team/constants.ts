import { cmsPersonIncluder, cmsPersonOrdering } from '@/cms/persons/constants'
import type { Prisma } from '@/prisma-generated-pn-types'

export const careersTeamDepartmentIncluder = {
    paragraph: true,
    persons: {
        include: cmsPersonIncluder,
        orderBy: cmsPersonOrdering,
    },
} as const satisfies Prisma.CareerTeamDepartmentInclude
