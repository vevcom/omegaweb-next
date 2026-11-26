/** The Matrix id of the user with a localpart on the homeserver named. */
export function matrixUserIdOf(localpart: string, serverName: string): string {
    return `@${localpart}:${serverName}`
}
