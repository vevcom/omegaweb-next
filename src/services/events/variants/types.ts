import type { EventQuotaExpanded } from '@/services/events/quotas/types'
import type { EventVariantSummary } from '@/services/events/types'
import type { SlotSchedule } from '@/services/events/slots/types'

/** A variant as its event's setup reads it, with who may register through each quota and its schedule. */
export type EventVariantExpanded = Omit<EventVariantSummary, 'quotas'> & {
    quotas: EventQuotaExpanded[],
    slotSchedule: SlotSchedule | null,
}
