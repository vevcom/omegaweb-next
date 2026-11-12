import { hasNoAdministrators } from './auth'
import type { EventCanView } from '@/prisma-generated-pn-types'
import type { VisibilityMatrix } from '@/services/visibility/types'

/** What a check is about, which is where in the event it is put right. */
export type SetupPart = 'time' | 'location' | 'visibility' | 'registration' | 'payment' | 'administrators'

/** `missing` stands in the way of saving or publishing. A `warning` is allowed, but rarely what was meant. */
export type SetupCheck = { part: SetupPart, level: 'missing' | 'warning', message: string }

export type SetupStatus = { level: 'ok' | 'warning' | 'missing', label: string }

export type EventSetup = {
    location: string | null,
    eventStart: Date,
    eventEnd: Date,
    canBeViewedBy: EventCanView,
    ledgerAccount: { id: number } | null,
    variants: {
        name: string,
        /** Null for a date the form has emptied. */
        registrationStart: Date | null,
        registrationEnd: Date | null,
        takesPayment: boolean,
        price?: number | null,
        paymentStart?: Date | null,
        paymentEnd?: Date | null,
        quotas: { places: number }[],
    }[],
    adminVisibility: VisibilityMatrix,
}

/**
 * A new event is given a start and an end at the same instant, since the database requires both.
 * Until they are set apart it has no time.
 */
export function hasNoTime(event: { eventStart: Date, eventEnd: Date }) {
    return event.eventStart.getTime() === event.eventEnd.getTime()
}

/** Everything to point out about how an event is set up, whether it is saved or still in the form. */
export function eventSetupChecks(event: EventSetup): SetupCheck[] {
    const checks: SetupCheck[] = []
    const add = (part: SetupPart, level: SetupCheck['level'], message: string) => checks.push({ part, level, message })

    if (hasNoTime(event) || event.eventStart > event.eventEnd) {
        add('time', 'missing', 'Sett når arrangementet starter og slutter.')
    }
    if (!event.location?.trim()) add('location', 'missing', 'Sett hvor arrangementet er.')
    if (event.canBeViewedBy === 'CAN_REGISTER' && !event.variants.some(variant => variant.quotas.length > 0)) {
        add('visibility', 'missing', 'Bare de som kan melde seg på ser arrangementet, men det har ingen kvoter.')
    }
    if (hasNoAdministrators(event.adminVisibility)) {
        add('administrators', 'missing', 'Velg hvem som kan administrere arrangementet.')
    }
    if (event.variants.some(variant => variant.takesPayment) && !event.ledgerAccount) {
        add('payment', 'missing', 'Arrangementet tar betaling, men er ikke knyttet til en konto.')
    }

    event.variants.forEach(variant => {
        const name = event.variants.length > 1 ? `${variant.name}: ` : ''
        if (!variant.registrationStart || !variant.registrationEnd) {
            add('registration', 'missing', `${name}Påmeldingsperioden må settes.`)
        } else if (variant.registrationStart >= variant.registrationEnd) {
            add('registration', 'missing', `${name}Påmeldingen slutter før den starter.`)
        } else if (variant.registrationEnd > event.eventStart) {
            add('registration', 'warning', `${name}Påmeldingen slutter etter at arrangementet har startet.`)
        }
        if (variant.quotas.every(quota => quota.places === 0)) {
            add('registration', 'warning', `${name}Ingen plasser er satt.`)
        }
        if (!variant.takesPayment) return
        if (!variant.price) add('payment', 'missing', `${name}Prisen mangler.`)
        if (!variant.paymentStart || !variant.paymentEnd) {
            add('payment', 'missing', `${name}Betalingsperioden må settes.`)
        } else if (variant.paymentStart >= variant.paymentEnd) {
            add('payment', 'missing', `${name}Betalingen slutter før den starter.`)
        } else if (variant.registrationEnd && variant.paymentEnd < variant.registrationEnd) {
            add('payment', 'warning', `${name}Betalingsfristen er før påmeldingen stenger.`)
        }
    })
    return checks
}

/** What must be in place before an event can be published. Empty when it is ready. */
export function publishProblems(event: EventSetup) {
    return eventSetupChecks(event).filter(check => check.level === 'missing').map(check => check.message)
}

/**
 * The worst of the checks of each group of parts, for wherever the parts are shown together, such
 * as on the tabs of a form. Every group gets a status, so that all clear shows too.
 */
export function setupStatuses<Group extends string>(
    checks: SetupCheck[],
    groupOf: Record<SetupPart, Group>,
): Record<Group, SetupStatus> {
    const statusOf = (group: Group): SetupStatus => {
        const ofGroup = checks.filter(check => groupOf[check.part] === group)
        if (ofGroup.length === 0) return { level: 'ok', label: 'I orden' }
        return {
            level: ofGroup.some(check => check.level === 'missing') ? 'missing' : 'warning',
            label: ofGroup.map(check => check.message).join(' '),
        }
    }
    // Every group is a value of `groupOf`, so the entries make up the whole record.
    return Object.fromEntries(Object.values(groupOf).map(group => [group, statusOf(group)])) as Record<Group, SetupStatus>
}
