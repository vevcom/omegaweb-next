import { afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals'
import { NextRequest } from 'next/server'
import type { NextResponse } from 'next/server'
import type { prisma as prismaClient } from '@/prisma-pn-client-instance'
import type { GET as endSessionRouteOfApp } from '@/app/api/oidc/end-session/route'
import type { authOptions as authOptionsOfApp } from '@/auth/nextAuth/authOptions'
import type { sessionTokenOf as sessionTokenOfApp } from '@/auth/nextAuth/sessionToken'
import type { oidcClientOf as oidcClientOfService } from '@/services/auth/oidc/clients'

const SESSION_COOKIE = '__Secure-next-auth.session-token'

type Loaded = {
    prisma: typeof prismaClient,
    endSessionRoute: typeof endSessionRouteOfApp,
    authOptions: typeof authOptionsOfApp,
    sessionTokenOf: typeof sessionTokenOfApp,
    oidcClientOf: typeof oidcClientOfService,
}
let loaded: Loaded

// Where the app reaches MAS is read from the environment when the service is loaded. The chat's
// sign in is a client all the same, by CHAT_AUTH_URL, and then one without an address.
beforeAll(async () => {
    Reflect.deleteProperty(process.env, 'CHAT_MAS_URL')
    loaded = {
        prisma: (await import('@/prisma-pn-client-instance')).prisma,
        endSessionRoute: (await import('@/app/api/oidc/end-session/route')).GET,
        authOptions: (await import('@/auth/nextAuth/authOptions')).authOptions,
        sessionTokenOf: (await import('@/auth/nextAuth/sessionToken')).sessionTokenOf,
        oidcClientOf: (await import('@/services/auth/oidc/clients')).oidcClientOf,
    }
})

afterEach(async () => {
    jest.restoreAllMocks()
    await loaded.prisma.user.deleteMany({ where: { username: 'test-sign-out-no-address' } })
})

describe('a sign out with no client that has an address for it', () => {
    test('tells no one, and logs the visitor out', async () => {
        const { prisma, endSessionRoute, authOptions, sessionTokenOf, oidcClientOf } = loaded
        const posted = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }))
        const chat = oidcClientOf('account.chat.localhost')
        expect(chat).not.toBeNull()
        expect(chat?.backchannelLogoutUri).toBeUndefined()

        const user = await prisma.user.create({
            data: {
                username: 'test-sign-out-no-address',
                email: 'test-sign-out-no-address@test.test',
                bioParagraph: { create: {} },
                ledgerAccount: { create: { type: 'USER' } },
                credentials: { create: { passwordHash: 'x' } },
            },
        })
        const token = await sessionTokenOf(user.id, 'credentials')
        expect(token.sid).toBeDefined()
        const cookie = await authOptions.jwt?.encode?.({ token, secret: process.env.NEXTAUTH_SECRET ?? '' })

        const response = await endSessionRoute(new NextRequest('https://omega.ntnu.no/api/oidc/end-session', {
            headers: { host: 'omega.ntnu.no', 'x-forwarded-proto': 'https', cookie: `${SESSION_COOKIE}=${cookie}` },
        })) as NextResponse
        expect(response.status).toBe(307)
        expect(response.cookies.get(SESSION_COOKIE)).toMatchObject({ value: '', maxAge: 0 })
        expect(posted).not.toHaveBeenCalled()
    })
})
