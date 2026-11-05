import type { VisibilityMatrix } from '@/services/visibility/types'

/** A requirement without conditions passes no one, so only EVENT_ADMIN gets in. */
export function hasNoAdministrators(adminVisibility: VisibilityMatrix) {
    return adminVisibility.requirements.length === 0
        || adminVisibility.requirements.some(requirement => requirement.conditions.length === 0)
}

/** What must be in place before an event can be published. Empty when it is ready. */
export function publishProblems(event: {
    location: string | null,
    eventStart: Date,
    eventEnd: Date,
    ledgerAccount: { id: number } | null,
    variants: { takesPayment: boolean }[],
    adminVisibility: VisibilityMatrix,
}) {
    const problems: string[] = []
    if (event.eventStart >= event.eventEnd) problems.push('Sett når arrangementet starter og slutter.')
    if (!event.location) problems.push('Sett hvor arrangementet er.')
    if (hasNoAdministrators(event.adminVisibility)) problems.push('Velg hvem som kan administrere arrangementet.')
    if (event.variants.some(variant => variant.takesPayment) && !event.ledgerAccount) {
        problems.push('Arrangementet tar betaling, men er ikke knyttet til en konto.')
    }
    return problems
}
