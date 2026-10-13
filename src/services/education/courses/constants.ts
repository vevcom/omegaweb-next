import type { Prisma } from '@/prisma-generated-pn-types'

/** A course as the lists show it: with the name of its school. */
export const courseIncluder = {
    school: { select: { id: true, name: true, shortName: true } },
} as const satisfies Prisma.CourseInclude
