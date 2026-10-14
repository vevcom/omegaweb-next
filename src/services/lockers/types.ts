import type { lockerReservationIncluder } from './constants'
import type { lockersSchemas } from './schemas'
import type { InferPagingCursor } from '@/lib/paging/schema'
import type { Prisma } from '@/prisma-generated-pn-types'

export type LockerWithReservation = Prisma.LockerGetPayload<{
    include: typeof lockerReservationIncluder,
}>

export type LockerCursor = InferPagingCursor<typeof lockersSchemas.params.readPage>
