/** When registration opens, among the variants that take registration, or null when it has opened. */
export function upcomingRegistrationStart(
    variants: { takesRegistration: boolean, registrationStart: Date }[],
    now: Date,
): Date | null {
    const starts = variants.filter(variant => variant.takesRegistration).map(variant => variant.registrationStart.getTime())
    if (starts.length === 0) return null
    const earliest = Math.min(...starts)
    return earliest > now.getTime() ? new Date(earliest) : null
}
