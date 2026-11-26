import '@ow-server-only'
import { authOptions, loginProvidersOn } from './authOptions'
import { sessionGoingOn } from './sessionToken'
import { domainContextOf } from '@/app/domainContextOfRequest'
import { readSessionToken } from '@/auth/sso/session'
import { oidcOperations } from '@/services/auth/oidc/operations'
import type { AuthOptions, CallbacksOptions } from 'next-auth'
import type { JWT } from 'next-auth/jwt'
import type { NextRequest } from 'next/server'

/**
 * NextAuth's options on the domain a request came to, offering the logins of that domain alone.
 *
 * The session on the auth domain is the one the provider's clients are signed in from, so
 * NextAuth's own sign out there ends it as the end session endpoint does. NextAuth hands the event
 * the session it is about to clear, which is null for a cookie it could not read. A sign in there
 * in a browser that holds a session ends that one too, unless it goes on, see sessionTokenAt.
 */
export function authOptionsOn(request: NextRequest): AuthOptions {
    const context = domainContextOf(request)
    const options = { ...authOptions, providers: loginProvidersOn(context) }
    if (!context.isAuthDomain()) return options
    return {
        ...options,
        callbacks: {
            ...authOptions.callbacks,
            jwt: params => sessionTokenAt(request, params),
        },
        events: {
            ...authOptions.events,
            signOut: ({ token }: { token: JWT | null }) => tellClientsOfEnd(token),
        },
    }
}

/**
 * The session token on the auth domain. NextAuth hands its jwt callback nothing of the session a
 * browser holds when it signs in, so that one is read from the request. The same user's goes on
 * under its id. Any other has ended with the cookie the sign in replaces, which no sign out tells
 * the clients of.
 */
async function sessionTokenAt(request: NextRequest, params: Parameters<CallbacksOptions['jwt']>[0]): Promise<JWT> {
    const jwt = authOptions.callbacks?.jwt
    if (!jwt) throw new Error('authOptions has no jwt callback')
    const token = await jwt(params)
    if (!params.trigger) return token
    const held = await readSessionToken(request)
    const goingOn = held && sessionGoingOn(held, token)
    if (goingOn) return goingOn
    await tellClientsOfEnd(held)
    return token
}

async function tellClientsOfEnd(session: JWT | null): Promise<void> {
    await oidcOperations.endSession({ params: { postLogoutRedirectUri: null, sid: session?.sid ?? null } })
}
