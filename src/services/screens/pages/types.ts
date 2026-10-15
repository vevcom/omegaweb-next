import type { screenPageIncluder } from './constants'
import type { Prisma } from '@/prisma-generated-pn-types'

export type ExpandedScreenPage = Prisma.ScreenPageGetPayload<{ include: typeof screenPageIncluder }>
