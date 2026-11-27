import { eventKinds } from './kinds'
import { hasNoTime } from './publishProblems'
import { osloDateTime } from '@/lib/dates/oslo'
import type { TimeBeforeEventDay } from './kinds'
import type { EventKind } from '@/prisma-generated-pn-types'

export type RegistrationPeriod = { registrationStart: Date, registrationEnd: Date }

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
