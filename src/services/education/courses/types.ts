import type { courseIncluder } from './constants'
import type { Prisma } from '@/prisma-generated-pn-types'

export type ExpandedCourse = Prisma.CourseGetPayload<{ include: typeof courseIncluder }>
