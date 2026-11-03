import '@pn-server-only'
import { generateJWT, verifyJWT } from '@/lib/jwt/jwt'
import { SiteContext } from '@/lib/sites/context'
import { loadDomainConfig } from '@/lib/sites/loadDomainConfig'
import { cookies } from 'next/headers'
import { z } from 'zod'
import type { JWT } from 'next-auth/jwt'

/**
 * A login is carried from one domain to another as a ticket: signed, short-lived, for the one
 * receiving origin, and for the state that origin remembered in a cookie before the hop. So a
 * ticket is worth nothing in another browser, and nobody can log someone else's browser into
 * their own account with one.
 */
const ticketLifetimeSeconds = 60

/** How long the receiving domain remembers that it asked, which also keeps the login form from asking again. */
const stateLifetimeSeconds = 5 * 60

const ticketClaimsSchema = z.object({
    sub: z.number().int(),
    provider: z.enum(['credentials', 'feide']),
    state: z.string().min(1),
    to: z.string().min(1),
})

export type TransferredUser = { id: string, sessionProvider: JWT['provider'] }

export function issueTransferTicket({ userId, provider, state, to }: {
    userId: number,
    provider: JWT['provider'],
    state: string,
    to: string,
}): string {
    return generateJWT('sessiontransfer', { sub: userId, provider, state, to }, ticketLifetimeSeconds)
}

/**
 * The user a ticket carries, when it was issued for this origin and for the state its cookie
 * holds; null otherwise.
 */
export function userOfTransferTicket(
    ticket: string | undefined,
    { origin, state }: { origin: string | null, state: string | undefined },
): TransferredUser | null {
    if (!ticket || !origin || !state) return null
    let claims: z.infer<typeof ticketClaimsSchema>
    try {
        claims = ticketClaimsSchema.parse(verifyJWT(ticket, 'sessiontransfer'))
    } catch {
        return null
    }
    if (claims.to !== origin || claims.state !== state) return null
    return { id: String(claims.sub), sessionProvider: claims.provider }
}

/**
 * The user of a ticket NextAuth's `sso` provider is handed, from the request it came with: the
 * host the proxy checked and the state cookie of that host.
 */
export function userOfTransferRequest(
    ticket: string | undefined,
    headers: Record<string, string | undefined>,
): TransferredUser | null {
    loadDomainConfig()
    const host = headers['x-forwarded-host'] ?? headers.host
    const origin = host ? SiteContext.fromAppPath(host, '/').origin() : null
    if (!origin) return null
    const name = transferStateCookie(origin).name
    const state = (headers.cookie ?? '').split(';')
        .map(part => part.trim())
        .find(part => part.startsWith(`${name}=`))
        ?.slice(name.length + 1)
    return userOfTransferTicket(ticket, { origin, state })
}

/** The cookie a receiving origin keeps the state of its ask in. */
export function transferStateCookie(origin: string) {
    const secure = origin.startsWith('https://')
    return {
        name: secure ? '__Host-sso-state' : 'sso-state',
        options: { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: stateLifetimeSeconds } as const,
    }
}

/** Whether this origin has asked for a login lately. */
export async function hasAskedForSession(origin: string): Promise<boolean> {
    return (await cookies()).has(transferStateCookie(origin).name)
}

/**
 * Where a hop may end: an app path on the domain it ends on, or a url on one of the configured
 * domains. Null for anything else, so no hop sends a browser off the sites.
 */
export function transferCallbackUrl(value: string | null | undefined): string | null {
    if (!value) return null
    try {
        const url = new URL(value, 'http://local.invalid')
        if (url.origin === 'http://local.invalid') return value.startsWith('/') ? value : null
        return SiteContext.isServedOrigin(url.origin) ? url.href : null
    } catch {
        return null
    }
}
