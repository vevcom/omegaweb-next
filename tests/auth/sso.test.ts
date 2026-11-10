import { GET as start } from '@/app/api/sso/start/route'
import { GET as ssoCallback } from '@/app/api/sso/callback/route'
import { GET as authorize } from '@/app/api/oidc/authorize/route'
import { authOptions } from '@/auth/nextAuth/authOptions'
import { sessionTokenOf } from '@/auth/nextAuth/sessionToken'
import { sessionCookieChunks } from '@/auth/nextAuth/sessionCookie'
import { endSession, readSessionToken, startSession } from '@/auth/sso/session'
import { DomainConfig } from '@/lib/sites/domainConfig'
import { DomainContext } from '@/lib/sites/context'
import { prisma } from '@/prisma-pn-client-instance'
import { testDomainConfig } from 'tests/testDomains'
import { afterAll, afterEach, beforeAll, describe, expect, test } from '@jest/globals'
import { NextRequest, NextResponse } from 'next/server'

/** A career site on its own domain, Omega's, and a domain set apart to sign in on. */
const withAuthDomain = DomainConfig.parse({
    'omega.ntnu.no': { site: 'OMEGAWEB', main: true },
    'contactor.no': { site: 'CAREERS', main: true },
    'login.omega.ntnu.no': { auth: true },
})

const SESSION_COOKIE = '__Secure-next-auth.session-token'
const STATE_COOKIE = '__Host-omega-sso'

/** A request as the proxy hands it on: over https, with the host it came to. */
const request = (url: string, cookies: Record<string, string> = {}) => new NextRequest(url, {
    headers: {
        host: new URL(url).host,
        'x-forwarded-proto': 'https',
        cookie: Object.entries(cookies).map(([name, value]) => `${name}=${value}`).join('; '),
    },
})

const location = (response: Response) => new URL(response.headers.get('location') ?? '', 'https://none.invalid')
const cookieOf = (response: NextResponse, name: string) => response.cookies.get(name)?.value

/** A user with a password, since a session from a credentials login is only good while the credentials exist. */
async function createUser(name: string) {
    return prisma.user.create({
        data: {
            username: `test-sso-${name}`,
            email: `test-sso-${name}@test.test`,
            bioParagraph: { create: {} },
            ledgerAccount: { create: { type: 'USER' } },
            credentials: { create: { passwordHash: 'x' } },
        },
    })
}

/** The cookie a user signed in on the auth domain with their password holds. */
async function sessionCookieFor(userId: number) {
    const encode = authOptions.jwt?.encode
    if (!encode) throw new Error('no encoder')
    return encode({ token: await sessionTokenOf(userId, 'credentials'), secret: process.env.NEXTAUTH_SECRET ?? '' })
}

async function decodeSession(cookie: string) {
    const decode = authOptions.jwt?.decode
    if (!decode) throw new Error('no decoder')
    return decode({ token: cookie, secret: process.env.NEXTAUTH_SECRET ?? '' })
}

beforeAll(() => DomainContext.configure(withAuthDomain))
afterAll(() => DomainContext.configure(testDomainConfig))
afterEach(async () => {
    await prisma.user.deleteMany({ where: { username: { startsWith: 'test-sso-' } } })
})

describe('a session too large for one cookie', () => {
    /** A session token of a user with more memberships than one cookie holds. */
    async function largeSessionCookie(userId: number) {
        const encode = authOptions.jwt?.encode
        if (!encode) throw new Error('no encoder')
        const token = await sessionTokenOf(userId, 'credentials')
        // Random, so that compressing the token does not make it small again.
        const padding = Array.from({ length: 400 }, () => Math.random().toString(36).slice(2)).join('')
        return encode({ token: { ...token, padding }, secret: process.env.NEXTAUTH_SECRET ?? '' })
    }

    test('is written in the chunks NextAuth reads, and replaces the cookies of the session before it', async () => {
        const user = await createUser('large')
        const value = await largeSessionCookie(user.id)
        const response = NextResponse.redirect('https://contactor.no/')
        const before = request('https://contactor.no/', { [SESSION_COOKIE]: 'old', [`${SESSION_COOKIE}.7`]: 'older' })

        const chunks = sessionCookieChunks(SESSION_COOKIE, value)
        expect(chunks.length).toBeGreaterThan(1)
        expect(chunks.map(chunk => chunk.name)).toEqual(chunks.map((_, index) => `${SESSION_COOKIE}.${index}`))
        expect(chunks.every(chunk => chunk.value.length <= 4096 - 163)).toBe(true)
        expect(chunks.map(chunk => chunk.value).join('')).toBe(value)
        expect(sessionCookieChunks(SESSION_COOKIE, 'short')).toEqual([{ name: SESSION_COOKIE, value: 'short' }])

        // NextAuth reads the chunks back as the one session.
        const cookies = Object.fromEntries(chunks.map(chunk => [chunk.name, chunk.value]))
        const withChunks = request('https://contactor.no/', cookies)
        expect(await readSessionToken(withChunks)).toMatchObject({ user: { id: user.id } })

        // A session started over one that was held clears what the new one does not use.
        await startSession(response, before, user.id, 'credentials')
        expect(response.cookies.get(SESSION_COOKIE)?.value).not.toBe('old')
        expect(response.cookies.get(`${SESSION_COOKIE}.7`)).toMatchObject({ value: '', maxAge: 0 })
    })

    test('is cleared chunk by chunk when the session ends', () => {
        const response = NextResponse.redirect('https://login.omega.ntnu.no/')
        const held = request('https://login.omega.ntnu.no/', {
            [`${SESSION_COOKIE}.0`]: 'first', [`${SESSION_COOKIE}.1`]: 'second', [`${SESSION_COOKIE}.extra`]: 'not ours',
        })
        endSession(response, held)
        for (const name of [SESSION_COOKIE, `${SESSION_COOKIE}.0`, `${SESSION_COOKIE}.1`]) {
            expect(response.cookies.get(name)).toMatchObject({ value: '', maxAge: 0, httpOnly: true, secure: true })
        }
        expect(response.cookies.get(`${SESSION_COOKIE}.extra`)).toBeUndefined()
    })
})

describe('signing in on a site through the auth domain', () => {
    test('the start route remembers the way back and sends the browser to authorize, with PKCE', async () => {
        const response = await start(request('https://contactor.no/api/sso/start?callbackUrl=%2Fcareer%2Fjob-ads'))
        expect(response.status).toBe(307)
        const authorizeUrl = location(response)
        expect(authorizeUrl.origin).toBe('https://login.omega.ntnu.no')
        expect(authorizeUrl.pathname).toBe('/api/oidc/authorize')
        expect(Object.fromEntries(authorizeUrl.searchParams)).toMatchObject({
            response_type: 'code',
            client_id: 'contactor.no',
            redirect_uri: 'https://contactor.no/api/sso/callback',
            scope: 'openid',
            code_challenge_method: 'S256',
            site: 'CAREERS',
        })
        expect(authorizeUrl.searchParams.get('state')).toMatch(/^[A-Za-z0-9_-]{43}$/)
        expect(cookieOf(response, STATE_COOKIE)).toBeDefined()
        expect(response.cookies.get(STATE_COOKIE))
            .toMatchObject({ httpOnly: true, secure: true, sameSite: 'lax', path: '/' })
    })

    test('a visitor already signed in on the domain goes straight on', async () => {
        const user = await createUser('signed-in')
        const response = await start(request('https://contactor.no/api/sso/start?callbackUrl=%2Fcareer%2Fjob-ads', {
            [SESSION_COOKIE]: await sessionCookieFor(user.id),
        }))
        expect(location(response).href).toBe('https://contactor.no/job-ads')
        expect(cookieOf(response, STATE_COOKIE)).toBeUndefined()
    })

    test('a redirect goes by the host the browser asked for, not the one the server listens on', async () => {
        const user = await createUser('listening-host')
        // As Next hands a request on: its url names the address the server listens on.
        const onAuthDomain = new NextRequest('http://localhost:3000/api/sso/start?callbackUrl=%2Fapi%2Foidc%2Fjwks', {
            headers: {
                host: 'login.omega.ntnu.no',
                'x-forwarded-proto': 'https',
                cookie: `${SESSION_COOKIE}=${await sessionCookieFor(user.id)}`,
            },
        })
        expect(location(await start(onAuthDomain)).href).toBe('https://login.omega.ntnu.no/api/oidc/jwks')
    })

    test('authorize sends a visitor without a session to the site\'s form, and one with a session back', async () => {
        const user = await createUser('authorize')
        const started = await start(request('https://contactor.no/api/sso/start?callbackUrl=%2Fcareer%2Fjob-ads'))
        const authorizeUrl = location(started)

        const anonymous = await authorize(request(authorizeUrl.href))
        const form = location(anonymous)
        expect(form.pathname).toBe('/career/login')
        expect(form.searchParams.get('callbackUrl')).toBe(`${authorizeUrl.pathname}${authorizeUrl.search}`)

        const signedIn = await authorize(request(authorizeUrl.href, { [SESSION_COOKIE]: await sessionCookieFor(user.id) }))
        const back = location(signedIn)
        expect(back.origin + back.pathname).toBe('https://contactor.no/api/sso/callback')
        expect(back.searchParams.get('state')).toBe(authorizeUrl.searchParams.get('state'))
        expect(back.searchParams.get('code')).toMatch(/^[A-Za-z0-9_-]{43}$/)
    })

    test('the callback exchanges the code for a session on the site and lands where the visitor was going', async () => {
        const user = await createUser('callback')
        const started = await start(request('https://contactor.no/api/sso/start?callbackUrl=%2Fcareer%2Fjob-ads'))
        const stateCookie = cookieOf(started, STATE_COOKIE) ?? ''
        const back = location(await authorize(request(location(started).href, {
            [SESSION_COOKIE]: await sessionCookieFor(user.id),
        })))

        const landed = await ssoCallback(request(back.href, { [STATE_COOKIE]: stateCookie }))
        expect(location(landed).href).toBe('https://contactor.no/job-ads')
        const session = cookieOf(landed, SESSION_COOKIE)
        expect(session).toBeDefined()
        expect(landed.cookies.get(SESSION_COOKIE))
            .toMatchObject({ httpOnly: true, secure: true, sameSite: 'lax', path: '/' })
        expect(landed.cookies.get(STATE_COOKIE)?.value).toBe('')
        const token = await decodeSession(session ?? '')
        expect(token).toMatchObject({ provider: 'credentials', user: { id: user.id, username: user.username } })
        expect(token?.permissions).toBeDefined()

        // The code is spent, and the state cookie has to be this browser's.
        const replayed = await ssoCallback(request(back.href, { [STATE_COOKIE]: stateCookie }))
        expect(location(replayed).href).toBe('https://contactor.no/')
        expect(cookieOf(replayed, SESSION_COOKIE)).toBeUndefined()
        expect((await ssoCallback(request(back.href))).status).toBe(400)
        const otherStart = await start(request('https://contactor.no/api/sso/start?callbackUrl=%2Fcareer'))
        const other = cookieOf(otherStart, STATE_COOKIE) ?? ''
        expect((await ssoCallback(request(back.href, { [STATE_COOKIE]: other }))).status).toBe(400)
    })

    test('a refused sign in lands on the frontpage, signed out', async () => {
        const started = await start(request('https://contactor.no/api/sso/start?callbackUrl=%2Fcareer%2Fjob-ads'))
        const state = location(started).searchParams.get('state') ?? ''
        const url = `https://contactor.no/api/sso/callback?error=server_error&state=${state}`
        const refused = await ssoCallback(request(url, { [STATE_COOKIE]: cookieOf(started, STATE_COOKIE) ?? '' }))
        expect(location(refused).href).toBe('https://contactor.no/')
        expect(cookieOf(refused, SESSION_COOKIE)).toBeUndefined()
    })

    test('on the auth domain the start route goes on with a session and to the form without one', async () => {
        const user = await createUser('on-auth')
        const authorizeUrl = location(await start(request('https://contactor.no/api/sso/start?callbackUrl=%2Fcareer')))
        const here = `${authorizeUrl.pathname}${authorizeUrl.search}`
        const url = `https://login.omega.ntnu.no/api/sso/start?callbackUrl=${encodeURIComponent(here)}`

        const withSession = await start(request(url, { [SESSION_COOKIE]: await sessionCookieFor(user.id) }))
        expect(location(withSession).href).toBe(`https://login.omega.ntnu.no${here}`)

        // An app-wide callback names no site, so the form is Omega's; authorize itself picks the site's.
        const without = await start(request(url))
        expect(location(without).pathname).toBe('/login')
        expect(location(without).searchParams.get('callbackUrl')).toBe(here)
    })

    test('a page\'s sign in started on the dedicated auth domain is handed to the domain the page is on', async () => {
        const response = await start(request('https://login.omega.ntnu.no/api/sso/start?callbackUrl=%2Fcareer%2Fjob-ads'))
        expect(location(response).href).toBe('https://contactor.no/api/sso/start?callbackUrl=%2Fcareer%2Fjob-ads')
        const omega = await start(request('https://login.omega.ntnu.no/api/sso/start?callbackUrl=%2Fusers%2Fme'))
        expect(location(omega).href).toBe('https://omega.ntnu.no/api/sso/start?callbackUrl=%2Fusers%2Fme')
    })

    test('without a dedicated auth domain, Omega\'s domain signs in with its own form and needs no code', async () => {
        DomainContext.configure(DomainConfig.parse({
            'omega.ntnu.no': { site: 'OMEGAWEB', main: true },
            'contactor.no': { site: 'CAREERS', main: true },
        }))
        try {
            const user = await createUser('fallback')
            const without = await start(request('https://omega.ntnu.no/api/sso/start?callbackUrl=%2Fusers%2Fme'))
            expect(location(without).href).toBe('https://omega.ntnu.no/login?callbackUrl=%2Fusers%2Fme')
            const withSession = await start(request('https://omega.ntnu.no/api/sso/start?callbackUrl=%2Fusers%2Fme', {
                [SESSION_COOKIE]: await sessionCookieFor(user.id),
            }))
            expect(location(withSession).href).toBe('https://omega.ntnu.no/users/me')
            // The career site still signs in through Omega's domain.
            const career = await start(request('https://contactor.no/api/sso/start?callbackUrl=%2Fcareer'))
            expect(location(career).origin).toBe('https://omega.ntnu.no')
        } finally {
            DomainContext.configure(withAuthDomain)
        }
    })
})
