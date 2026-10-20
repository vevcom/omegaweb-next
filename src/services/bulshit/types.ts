import type { bulshitFieldsToExpose } from './constants'
import type { bulshitSchemas } from './schemas'
import type { InferPagingCursor } from '@/lib/paging/schema'
import type { Bulshit } from '@/prisma-generated-pn-types'

export type BulshitFiltered = Pick<Bulshit, typeof bulshitFieldsToExpose[number]>

export type BulshitCursor = InferPagingCursor<typeof bulshitSchemas.params.readPage>
