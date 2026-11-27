import { eventKinds } from './kinds'
import { hasNoTime } from './publishProblems'
import { defaultSlotSchedule } from './slots/schedule'
import { osloDateTime } from '@/lib/dates/oslo'
import type { TimeBeforeEventDay } from './kinds'
import type { SlotScheduleDraft } from './slots/types'
import type { EventKind, EventRegistrationType } from '@/prisma-generated-pn-types'

export type RegistrationPeriod = { registrationStart: Date, registrationEnd: Date }

/** What the kind gives the first variant of an event. */
export type FirstVariantSetup = {
    registrationType: EventRegistrationType,
    registrationPeriod: RegistrationPeriod | null,
    /** The schedule of a slotted variant, which starts as `slotsStartOf` says. */
    slotSchedule: SlotScheduleDraft | null,
}

/**
 * The registration period the kind gives the first variant of an event, reckoned from its start.
 * Null when the kind gives none, or the event has no time to reckon from.
 */
export function firstRegistrationPeriod(
    kind: EventKind,
    event: { eventStart: Date, eventEnd: Date },
): RegistrationPeriod | null {
    const period = eventKinds[kind].firstSetup.registrationPeriod
    const eventDay = osloDateTime(event.eventStart).startOf('day')
    if (!period || hasNoTime(event) || !eventDay.isValid) return null

    const at = ({ daysBefore, hour }: TimeBeforeEventDay) => eventDay.minus({ days: daysBefore }).set({ hour }).toJSDate()
    const closes = at(period.closes)
    // An event that starts earlier in the day than the period closes takes no registration after it has started.
    return { registrationStart: at(period.opens), registrationEnd: closes < event.eventStart ? closes : event.eventStart }
}

/**
 * Where a schedule made for the event starts: when the event does, and nowhere while it has no
 * time, since its start is then a placeholder that setting the time does not move the slots from.
 */
export function slotsStartOf(event: { eventStart: Date, eventEnd: Date }): Date | null {
    return hasNoTime(event) ? null : event.eventStart
}

export function firstVariantSetup(kind: EventKind, event: { eventStart: Date, eventEnd: Date }): FirstVariantSetup {
    const { registrationType } = eventKinds[kind].firstSetup
    return {
        registrationType,
        registrationPeriod: firstRegistrationPeriod(kind, event),
        slotSchedule: registrationType === 'SLOTTED' ? defaultSlotSchedule(slotsStartOf(event)) : null,
    }
}
