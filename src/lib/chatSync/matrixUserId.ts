/** The Matrix id of the user with a localpart on the homeserver named. */
export function matrixUserIdOf(localpart: string, serverName: string): string {
    return `@${localpart}:${serverName}`
}

/** The localpart of a Matrix id on the homeserver named, or null for an id that is not of it. */
export function localpartOf(matrixUserId: string, serverName: string): string | null {
    const ending = `:${serverName}`
    const isOfServer = matrixUserId.startsWith('@') && matrixUserId.endsWith(ending)
    return isOfServer ? matrixUserId.slice(1, -ending.length) : null
}
