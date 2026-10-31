import type { EventQuotaExpanded } from '@/services/events/quotas/types'
import type { EventVariantSummary } from '@/services/events/types'

export type EventVariantExpanded = Omit<EventVariantSummary, 'quotas'> & {
    quotas: EventQuotaExpanded[],
}
