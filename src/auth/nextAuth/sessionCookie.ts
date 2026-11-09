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
