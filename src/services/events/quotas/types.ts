import type { EventQuotaSummary } from '@/services/events/types'
import type { VisibilityMatrix } from '@/services/visibility/types'

export type EventQuotaExpanded = EventQuotaSummary & {
    visibility: VisibilityMatrix,
}
