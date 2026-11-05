/** What must be in place before an event can be published. Empty when it is ready. */
export function publishProblems(event: {
    location: string | null,
    eventStart: Date,
    eventEnd: Date,
    ledgerAccount: { id: number } | null,
    variants: { takesPayment: boolean }[],
}) {
    const problems: string[] = []
    if (event.eventStart >= event.eventEnd) problems.push('Sett når arrangementet starter og slutter.')
    if (!event.location) problems.push('Sett hvor arrangementet er.')
    if (event.variants.some(variant => variant.takesPayment) && !event.ledgerAccount) {
        problems.push('Arrangementet tar betaling, men er ikke knyttet til en konto.')
    }
    return problems
}
