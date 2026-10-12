import type { bullshitFieldsToExpose } from './constants'
import type { bullshitSchemas } from './schemas'
import type { InferPagingCursor } from '@/lib/paging/schema'
import type { Bullshit } from '@/prisma-generated-pn-types'

export type BullshitFiltered = Pick<Bullshit, typeof bullshitFieldsToExpose[number]>

export type BullshitCursor = InferPagingCursor<typeof bullshitSchemas.readPage>
