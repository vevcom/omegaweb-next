/** The name of whom a registration is for: its user, or the guest it was made for. */
export function registrantName({ user, contact }: {
    user: { firstname: string, lastname: string } | null,
    contact: { name: string } | null,
}) {
    return user ? `${user.firstname} ${user.lastname}` : contact?.name ?? 'Ukjent'
}
