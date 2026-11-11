/**
 * The cookie NextAuth keeps the session in. NextAuth names it by the protocol the request came on,
 * `__Secure-` prefixed on https, which it reads from `x-forwarded-proto` the way `detectOrigin`
 * does: anything but `http` is https. Code that reads or writes the cookie itself, as the OpenID
 * Connect provider does, picks the name the same way, so the two never look in different places.
 */
export function sessionCookieOf(headers: Headers): { name: string, secure: boolean } {
    const secure = headers.get('x-forwarded-proto') !== 'http'
    return { name: secure ? '__Secure-next-auth.session-token' : 'next-auth.session-token', secure }
}

/**
 * What NextAuth puts in one cookie of the session: a browser takes 4096 bytes for a cookie, of
 * which NextAuth sets 163 aside for the name and the attributes.
 */
const CHUNK_SIZE = 4096 - 163

/**
 * A session token as the cookies NextAuth keeps it in: the one cookie when it fits, and otherwise
 * split over `<name>.0`, `<name>.1` and so on, which NextAuth joins when it reads the session. Its
 * own code for this is not exported, so the split is repeated here.
 */
export function sessionCookieChunks(name: string, value: string): { name: string, value: string }[] {
    if (value.length <= CHUNK_SIZE) return [{ name, value }]
    return Array.from({ length: Math.ceil(value.length / CHUNK_SIZE) }, (_, index) => ({
        name: `${name}.${index}`,
        value: value.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE),
    }))
}

/** Which of the cookies a request came with hold the session: the one cookie, or its chunks. */
export function sessionCookieNamesAmong(name: string, cookieNames: string[]): string[] {
    return cookieNames.filter(cookieName => cookieName === name || (
        cookieName.startsWith(`${name}.`) && /^\d+$/.test(cookieName.slice(name.length + 1))
    ))
}
