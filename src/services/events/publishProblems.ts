import type { EventCanView } from '@/prisma-generated-pn-types'
import type { VisibilityMatrix } from '@/services/visibility/types'

export type SetupTab = 'about' | 'rules' | 'registration' | 'payment' | 'access'

/** `missing` stands in the way of saving or publishing. A `warning` is allowed, but rarely what was meant. */
export type SetupCheck = { tab: SetupTab, level: 'missing' | 'warning', message: string }

export type TabStatus = { level: 'ok' | 'warning' | 'missing', label: string }

type EventSetup = {
    location: string | null,
    eventStart: Date,
    eventEnd: Date,
    canBeViewedBy: EventCanView,
    ledgerAccount: { id: number } | null,
    variants: {
        name: string,
        registrationStart: Date,
        registrationEnd: Date,
        takesPayment: boolean,
        price?: number | null,
        paymentStart?: Date | null,
        paymentEnd?: Date | null,
        quotas: { places: number }[],
    }[],
    adminVisibility: VisibilityMatrix,
}

/** A requirement without conditions passes no one, so only EVENT_ADMIN gets in. */
export function hasNoAdministrators(adminVisibility: VisibilityMatrix) {
    return adminVisibility.requirements.length === 0
        || adminVisibility.requirements.some(requirement => requirement.conditions.length === 0)
}

/** Everything to point out about how an event is set up, whether it is saved or still in the form. */
export function eventSetupChecks(event: EventSetup): SetupCheck[] {
    const checks: SetupCheck[] = []
    const add = (tab: SetupTab, level: SetupCheck['level'], message: string) => checks.push({ tab, level, message })

    if (event.eventStart >= event.eventEnd) add('about', 'missing', 'Sett når arrangementet starter og slutter.')
    if (!event.location?.trim()) add('about', 'missing', 'Sett hvor arrangementet er.')
    if (event.canBeViewedBy === 'CAN_REGISTER' && !event.variants.some(variant => variant.quotas.length > 0)) {
        add('rules', 'missing', 'Bare de som kan melde seg på ser arrangementet, men det har ingen kvoter.')
    }
    if (hasNoAdministrators(event.adminVisibility)) {
        add('access', 'missing', 'Velg hvem som kan administrere arrangementet.')
    }
    if (event.variants.some(variant => variant.takesPayment) && !event.ledgerAccount) {
        add('payment', 'missing', 'Arrangementet tar betaling, men er ikke knyttet til en konto.')
    }

    event.variants.forEach(variant => {
        const name = event.variants.length > 1 ? `${variant.name}: ` : ''
        if (variant.registrationStart >= variant.registrationEnd) {
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
        } else if (variant.paymentEnd < variant.registrationEnd) {
            add('payment', 'warning', `${name}Betalingsfristen er før påmeldingen stenger.`)
        }
    })
    return checks
}

/** What must be in place before an event can be published. Empty when it is ready. */
export function publishProblems(event: EventSetup) {
    return eventSetupChecks(event).filter(check => check.level === 'missing').map(check => check.message)
}

/** The worst of each tab's checks. Every setup tab gets a status, so that all clear shows too. */
export function setupTabStatuses(checks: SetupCheck[]) {
    const statusOf = (tab: SetupTab): TabStatus => {
        const ofTab = checks.filter(check => check.tab === tab)
        if (ofTab.length === 0) return { level: 'ok', label: 'I orden' }
        return {
            level: ofTab.some(check => check.level === 'missing') ? 'missing' : 'warning',
            label: ofTab.map(check => check.message).join(' '),
        }
    }
    return {
        about: statusOf('about'),
        rules: statusOf('rules'),
        registration: statusOf('registration'),
        payment: statusOf('payment'),
        access: statusOf('access'),
    }
}
