import { GET as authorizeRoute } from '@/app/api/oidc/authorize/route'
import { GET as endSessionRoute } from '@/app/api/oidc/end-session/route'
import { GET as nextAuthGet, POST as nextAuthPost } from '@/app/api/auth/[...nextauth]/route'
import { authOptions } from '@/auth/nextAuth/authOptions'
import { companySessionTokenOf, sessionTokenOf } from '@/auth/nextAuth/sessionToken'
import { hashAndEncryptPassword } from '@/auth/passwordHash'
import { readSessionToken } from '@/auth/sso/session'
import { oidcOperations } from '@/services/auth/oidc/operations'
import { oidcClientOf, oidcClientsToldOfSignOut } from '@/services/auth/oidc/clients'
import { postLogoutToken } from '@/services/auth/oidc/backchannelLogout'
import { OIDC_BACKCHANNEL_LOGOUT_TIMEOUT_MS, SSO_CALLBACK_PATH } from '@/services/auth/oidc/constants'
import { discoveryDocument } from '@/services/auth/oidc/discovery'
import { jwks, signLogoutToken } from '@/services/auth/oidc/tokens'
import { DomainConfig } from '@/lib/sites/domainConfig'
import { DomainContext } from '@/lib/sites/context'
import logger from '@/lib/logger'
import { prisma } from '@/prisma-pn-client-instance'
import { testDomainConfig } from 'tests/testDomains'
import { afterEach, describe, expect, jest, test } from '@jest/globals'
import { decode, verify } from 'jsonwebtoken'
import { NextRequest } from 'next/server'
import { createHash, createPublicKey } from 'node:crypto'
import type { JWT } from 'next-auth/jwt'
import type { NextResponse } from 'next/server'

// The one domain the tests run with, see tests/testDomains.ts: Omega's, which is also the auth domain.
const ISSUER = 'https://omega.ntnu.no'
// The chat's sign in of .env.default, and MAS as the app reaches it there: the one client with an address.
const CHAT_CLIENT = 'account.chat.localhost'
const CHAT_ADDRESS = 'http://mas:8081/upstream/backchannel-logout/000000000000000000000VEVEN'
const SESSION_COOKIE = '__Secure-next-auth.session-token'
const LOGOUT_EVENT = 'http://schemas.openid.net/event/backchannel-logout'
const PASSWORD = 'et-langt-nok-passord-123'
// Hashed once for the file, since a hash is made slow on purpose.
const hashOfPassword = hashAndEncryptPassword(PASSWORD)

// NextAuth's route handler reads the request through next/headers, which only a running server answers.
let mockRequest: NextRequest
jest.mock('next/headers', () => ({
    headers: () => Promise.resolve(mockRequest.headers),
    cookies: () => Promise.resolve(mockRequest.cookies),
}))

type Cookies = Record<string, string>

/** A request as the proxy hands it on: over https, with the host it came to. */
const request = (url: string, cookies: Cookies = {}, init: { method?: string, body?: URLSearchParams } = {}) =>
    new NextRequest(url, {
        ...init,
        headers: {
            host: new URL(url).host,
            'x-forwarded-proto': 'https',
            cookie: Object.entries(cookies).map(([name, value]) => `${name}=${value}`).join('; '),
            ...(init.body ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
        },
    })

async function createUser(name: string, passwordHash = 'x') {
    return prisma.user.create({
        data: {
            username: `test-sign-out-${name}`,
            email: `test-sign-out-${name}@test.test`,
            bioParagraph: { create: {} },
            ledgerAccount: { create: { type: 'USER' } },
            credentials: { create: { passwordHash } },
        },
    })
}

/** A user who can sign in with PASSWORD, as what the login form sends. */
async function createUserWithPassword(name: string) {
    const { username } = await createUser(name, await hashOfPassword)
    return { username, password: PASSWORD }
}

async function cookieOf(token: JWT): Promise<string> {
    const encode = authOptions.jwt?.encode
    if (!encode) throw new Error('no encoder')
    return encode({ token, secret: process.env.NEXTAUTH_SECRET ?? '' })
}

/** A user signed in on the auth domain with their password: the cookie they hold, and the id of the session. */
async function signedIn(name: string) {
    const token = await sessionTokenOf((await createUser(name)).id, 'credentials')
    if (!token.sid) throw new Error('a session that starts has an id')
    return { cookies: { [SESSION_COOKIE]: await cookieOf(token) }, sid: token.sid, token }
}

/**
 * A company user signed in on the career site: the cookie they hold, whose session has no id, and
 * what the company login form sends for them when they are given `passwordHash`.
 */
async function companySignedIn(passwordHash = 'x') {
    const company = await prisma.company.create({ data: { name: 'Utloggingstest AS', description: '' } })
    const companyUser = await prisma.companyUser.create({
        data: {
            companyId: company.id,
            email: 'utlogging@example.com',
            firstname: 'Kari',
            lastname: 'Nordmann',
            credentials: { create: { passwordHash } },
        },
    })
    return {
        cookies: { [SESSION_COOKIE]: await cookieOf(await companySessionTokenOf(companyUser.id)) },
        credentials: { email: companyUser.email, password: PASSWORD },
    }
}

type Answer = (init: RequestInit) => Promise<Response>
const answers = (status: number): Answer => () => Promise.resolve(new Response(null, { status }))
const refusesTheConnection: Answer = () => Promise.reject(new TypeError('fetch failed', {
    cause: Object.assign(new Error('connect ECONNREFUSED 10.0.0.1:8081'), { code: 'ECONNREFUSED' }),
}))
const hangs: Answer = ({ signal }) => new Promise((_, reject) => {
    signal?.addEventListener('abort', () => reject(signal.reason as Error))
})

/** What the app posts while the clients answer with `answer`: each request, with the logout token it carries. */
function clientsAnswer(answer: Answer) {
    const posted: { address: string, init: RequestInit, logoutToken: string }[] = []
    jest.spyOn(globalThis, 'fetch').mockImplementation((address, init = {}) => {
        if (typeof address !== 'string' || typeof init.body !== 'string') throw new Error('not a form to an address')
        const logoutToken = new URLSearchParams(init.body).get('logout_token') ?? ''
        posted.push({ address, init, logoutToken })
        return answer(init)
    })
    return posted
}

/** What is logged as an error, as one text. */
function errorsLogged() {
    const errors = jest.spyOn(logger, 'error').mockImplementation(() => logger)
    return () => JSON.stringify(errors.mock.calls)
}

const endSession = (cookies: Cookies = {}, query = '') =>
    endSessionRoute(request(`${ISSUER}/api/oidc/end-session${query}`, cookies)) as Promise<NextResponse>

const isLoggedOut = (response: NextResponse) => response.status === 307
    && response.cookies.get(SESSION_COOKIE)?.value === ''
    && response.cookies.get(SESSION_COOKIE)?.maxAge === 0

/** A form posted to NextAuth as its client does it: the token against forged requests, then the form. */
async function postToNextAuth(origin: string, action: string[], cookies: Cookies, fields: Record<string, string> = {}) {
    const context = (nextauth: string[]) => ({ params: Promise.resolve({ nextauth }) })
    mockRequest = request(`${origin}/api/auth/csrf`)
    const csrf = await nextAuthGet(mockRequest, context(['csrf'])) as Response
    const { csrfToken } = await csrf.json() as { csrfToken: string }
    const [csrfCookie] = csrf.headers.getSetCookie().map(cookie => cookie.split(';')[0].split('='))
    const held = { ...cookies, [csrfCookie[0]]: decodeURIComponent(csrfCookie[1]) }
    mockRequest = request(`${origin}/api/auth/${action.join('/')}`, held, {
        method: 'POST',
        body: new URLSearchParams({ ...fields, csrfToken, json: 'true' }),
    })
    return await nextAuthPost(mockRequest, context(action)) as Response
}

/** NextAuth's own sign out. */
async function nextAuthSignOut(origin: string, cookies: Cookies) {
    const response = await postToNextAuth(origin, ['signout'], cookies)
    const cleared = response.headers.getSetCookie().some(cookie => cookie.startsWith(`${SESSION_COOKIE}=;`))
    return { status: response.status, cleared }
}

/**
 * A sign in through NextAuth on the auth domain, in a browser that holds `cookies`: the session
 * cookie it is given, none when the sign in is refused, and the session that cookie reads as.
 */
async function nextAuthSignIn(
    login: 'credentials' | 'company-credentials',
    credentials: Record<string, string>,
    cookies: Cookies = {},
) {
    const response = await postToNextAuth(ISSUER, ['callback', login], cookies, credentials)
    const given: Cookies = {}
    for (const cookie of response.headers.getSetCookie()) {
        const [name, value] = cookie.split(';')[0].split('=')
        if (name.startsWith(SESSION_COOKIE) && value !== '') given[name] = value
    }
    return { cookies: given, session: await readSessionToken(request(`${ISSUER}/`, given)) }
}

/** The `sid` of the ID token a client is given for the browser that holds `cookies`: here Omega's own site. */
async function sidOfIdTokenFor(cookies: Cookies) {
    const client = { clientId: new URL(ISSUER).host, redirectUri: `${ISSUER}${SSO_CALLBACK_PATH}` }
    const codeVerifier = 'a-verifier-of-the-length-that-pkce-asks-for-43'
    const query = new URLSearchParams({
        client_id: client.clientId,
        redirect_uri: client.redirectUri,
        response_type: 'code',
        scope: 'openid',
        state: 'state-1',
        code_challenge: createHash('sha256').update(codeVerifier).digest('base64url'),
        code_challenge_method: 'S256',
    })
    const back = await authorizeRoute(request(`${ISSUER}/api/oidc/authorize?${query.toString()}`, cookies))
    const code = new URL(back.headers.get('location') ?? '').searchParams.get('code') ?? ''
    const tokens = await oidcOperations.token({ data: { grantType: 'authorization_code', ...client, code, codeVerifier } })
    return (decode(tokens.id_token) as JWT).sid
}

afterEach(async () => {
    jest.restoreAllMocks()
    DomainContext.configure(testDomainConfig)
    await prisma.user.deleteMany({ where: { username: { startsWith: 'test-sign-out-' } } })
    await prisma.company.deleteMany({ where: { name: 'Utloggingstest AS' } })
})

describe('the logout token', () => {
    test('says to one client that one session has ended, for a short while, signed with the published key', () => {
        const logoutToken = signLogoutToken({ clientId: CHAT_CLIENT, sid: 'session-1' })
        const [key] = jwks().keys
        expect(decode(logoutToken, { complete: true })?.header).toEqual({ alg: 'ES256', typ: 'logout+jwt', kid: key.kid })

        const claims = verify(logoutToken, createPublicKey({ key, format: 'jwk' }), { algorithms: ['ES256'] }) as JWT
        const { iat, exp, jti, ...said } = claims as JWT & { exp: number, jti: string }
        expect(said).toEqual({ iss: ISSUER, aud: CHAT_CLIENT, sid: 'session-1', events: { [LOGOUT_EVENT]: {} } })
        expect(exp - (iat ?? 0)).toBe(120)
        expect(jti).toMatch(/^[A-Za-z0-9_-]{22}$/)
        expect(decode(signLogoutToken({ clientId: CHAT_CLIENT, sid: 'session-1' }))).not.toMatchObject({ jti })
    })

    test('is posted as a form to the address alone, and a client that does not take it is an error', async () => {
        const posted = clientsAnswer(answers(200))
        await postLogoutToken(CHAT_ADDRESS, 'the.logout.token')
        expect(posted).toHaveLength(1)
        expect(posted[0].address).toBe(CHAT_ADDRESS)
        expect(posted[0].init).toMatchObject({
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'logout_token=the.logout.token',
            redirect: 'manual',
        })
        expect(posted[0].init.signal).toBeInstanceOf(AbortSignal)

        for (const status of [302, 400, 404, 500]) {
            clientsAnswer(answers(status))
            const refusal = postLogoutToken(CHAT_ADDRESS, 'the.logout.token')
            await expect(refusal).rejects.toThrow(String(status))
            await expect(refusal).rejects.not.toThrow('the.logout.token')
        }
    })
})

describe('who is told of a sign out', () => {
    test('the chat\'s sign in alone has an address for it, on MAS as the app reaches it', () => {
        expect(oidcClientOf(CHAT_CLIENT)?.backchannelLogoutUri).toBe(CHAT_ADDRESS)
        expect(oidcClientOf('omega.ntnu.no')?.backchannelLogoutUri).toBeUndefined()
        expect(oidcClientOf('mail.omegaweb.localhost')?.backchannelLogoutUri).toBeUndefined()
        expect(oidcClientsToldOfSignOut()).toEqual([{ id: CHAT_CLIENT, backchannelLogoutUri: CHAT_ADDRESS }])
        expect(discoveryDocument()).toMatchObject({
            backchannel_logout_supported: true,
            backchannel_logout_session_supported: true,
        })
    })

    test('the operation tells each client with an address once, by the session\'s id, and no one without one', async () => {
        const posted = clientsAnswer(answers(200))
        await expect(oidcOperations.endSession({ params: { postLogoutRedirectUri: null, sid: 'session-1' } }))
            .resolves.toEqual({ redirectTo: `${ISSUER}/` })
        expect(posted.map(post => post.address)).toEqual([CHAT_ADDRESS])
        expect(decode(posted[0].logoutToken)).toMatchObject({ aud: CHAT_CLIENT, sid: 'session-1' })

        await oidcOperations.endSession({ params: { postLogoutRedirectUri: null, sid: null } })
        expect(posted).toHaveLength(1)
    })
})

describe('the end session endpoint', () => {
    test('tells the chat\'s sign in which session ended, and logs the visitor out', async () => {
        const posted = clientsAnswer(answers(200))
        const { cookies, sid } = await signedIn('endpoint')
        const response = await endSession(cookies, `?post_logout_redirect_uri=${encodeURIComponent(`${ISSUER}/career`)}`)

        expect(isLoggedOut(response)).toBe(true)
        expect(response.headers.get('location')).toBe(`${ISSUER}/career`)
        expect(posted.map(post => post.address)).toEqual([CHAT_ADDRESS])
        expect(decode(posted[0].logoutToken)).toMatchObject({ iss: ISSUER, aud: CHAT_CLIENT, sid })
        expect(decode(posted[0].logoutToken)).not.toHaveProperty('sub')
    })

    test('tells no one without a session, also when the request names one, or of a session that has no id', async () => {
        const posted = clientsAnswer(answers(200))
        expect(isLoggedOut(await endSession())).toBe(true)
        expect(isLoggedOut(await endSession({}, '?sid=someone'))).toBe(true)
        expect(isLoggedOut(await endSession({ [SESSION_COOKIE]: 'not a session' }))).toBe(true)

        // A session started before sessions had an id.
        const { token: { sid, ...before } } = await signedIn('before')
        expect(sid).toBeDefined()
        expect(isLoggedOut(await endSession({ [SESSION_COOKIE]: await cookieOf(before) }))).toBe(true)

        // A company user's session, which the provider signs no client in from.
        expect(isLoggedOut(await endSession((await companySignedIn()).cookies))).toBe(true)

        expect(posted).toEqual([])
    })

    test.each([
        ['answers 404', answers(404), '404'],
        ['answers 500', answers(500), '500'],
        ['refuses the connection', refusesTheConnection, 'ECONNREFUSED'],
        ['does not answer within the timeout', hangs, 'timeout'],
    ])('logs the visitor out when the chat\'s sign in %s, and logs who was not told and why', async (_, answer, reason) => {
        const posted = clientsAnswer(answer)
        const logged = errorsLogged()
        const { cookies, sid } = await signedIn('refused')
        const startedAt = Date.now()
        const response = await endSession(cookies)

        expect(isLoggedOut(response)).toBe(true)
        expect(response.headers.get('location')).toBe(`${ISSUER}/`)
        expect(posted).toHaveLength(1)
        expect(logged()).toContain(CHAT_CLIENT)
        expect(logged()).toContain(CHAT_ADDRESS)
        expect(logged()).toContain(reason)
        expect(logged()).not.toContain(posted[0].logoutToken)
        expect(logged()).not.toContain(sid)
        if (answer === hangs) {
            const waited = Date.now() - startedAt
            expect(waited).toBeGreaterThanOrEqual(OIDC_BACKCHANNEL_LOGOUT_TIMEOUT_MS - 50)
            expect(waited).toBeLessThan(OIDC_BACKCHANNEL_LOGOUT_TIMEOUT_MS + 1500)
        }
    }, 10_000)

    test('is not there on a domain that is not the auth domain, and tells no one from it', async () => {
        const posted = clientsAnswer(answers(200))
        DomainContext.configure(DomainConfig.parse({
            'omega.ntnu.no': { site: 'OMEGAWEB', main: true },
            'login.omega.ntnu.no': { auth: true },
        }))
        const { cookies } = await signedIn('site')
        expect((await endSession(cookies)).status).toBe(404)
        expect(posted).toEqual([])
    })
})

describe('NextAuth\'s own sign out', () => {
    test('on the auth domain tells the chat\'s sign in which session ended, and clears the cookie', async () => {
        const posted = clientsAnswer(answers(200))
        const { cookies, sid } = await signedIn('nextauth')
        expect(await nextAuthSignOut(ISSUER, cookies)).toEqual({ status: 200, cleared: true })
        expect(posted.map(post => post.address)).toEqual([CHAT_ADDRESS])
        expect(decode(posted[0].logoutToken)).toMatchObject({ aud: CHAT_CLIENT, sid })

        // The cookie is gone, so the end session endpoint the browser goes on to tells no one again.
        expect(isLoggedOut(await endSession())).toBe(true)
        expect(posted).toHaveLength(1)
    })

    test('clears the cookie when the chat\'s sign in is not told, and tells no one without a session', async () => {
        const posted = clientsAnswer(refusesTheConnection)
        const logged = errorsLogged()
        const { cookies } = await signedIn('nextauth-refused')
        expect(await nextAuthSignOut(ISSUER, cookies)).toEqual({ status: 200, cleared: true })
        expect(posted).toHaveLength(1)
        expect(logged()).toContain('ECONNREFUSED')

        await nextAuthSignOut(ISSUER, {})
        expect(posted).toHaveLength(1)
    })

    test('on a site\'s domain tells no one, and on the auth domain set apart from it tells once', async () => {
        const posted = clientsAnswer(answers(200))
        DomainContext.configure(DomainConfig.parse({
            'omega.ntnu.no': { site: 'OMEGAWEB', main: true },
            'login.omega.ntnu.no': { auth: true },
        }))
        const { cookies } = await signedIn('nextauth-site')
        expect(await nextAuthSignOut(ISSUER, cookies)).toEqual({ status: 200, cleared: true })
        expect(posted).toEqual([])

        expect(await nextAuthSignOut('https://login.omega.ntnu.no', cookies)).toEqual({ status: 200, cleared: true })
        expect(posted).toHaveLength(1)
    })

    test('on a domain that is the auth domain and serves the career site, tells of a user alone', async () => {
        const posted = clientsAnswer(answers(200))
        expect(await nextAuthSignOut(ISSUER, (await companySignedIn()).cookies)).toEqual({ status: 200, cleared: true })
        expect(posted).toEqual([])

        const { cookies, sid } = await signedIn('nextauth-beside-company')
        expect(await nextAuthSignOut(ISSUER, cookies)).toEqual({ status: 200, cleared: true })
        expect(posted.map(post => decode(post.logoutToken))).toMatchObject([{ aud: CHAT_CLIENT, sid }])
    })
})

describe('a sign in on the auth domain', () => {
    test('starts a session with an id and tells no one, in a browser that holds none or one without an id', async () => {
        const posted = clientsAnswer(answers(200))
        const user = await createUserWithPassword('first')
        const first = await nextAuthSignIn('credentials', user)
        expect(first.session?.sid).toMatch(/^[A-Za-z0-9_-]{22}$/)

        // A session started before sessions had an id.
        const { sid, ...before } = first.session ?? {} as JWT
        const second = await nextAuthSignIn('credentials', user, { [SESSION_COOKIE]: await cookieOf(before) })
        expect(second.session?.sid).toMatch(/^[A-Za-z0-9_-]{22}$/)
        expect(second.session?.sid).not.toBe(sid)
        expect(posted).toEqual([])
    })

    test('as the user the browser is signed in as goes on with that session under its id and tells no one', async () => {
        const posted = clientsAnswer(answers(200))
        const user = await createUserWithPassword('again')
        const first = await nextAuthSignIn('credentials', user)
        const again = await nextAuthSignIn('credentials', user, first.cookies)

        expect(again.cookies).not.toEqual(first.cookies)
        expect(again.session?.sid).toBe(first.session?.sid)
        expect(await sidOfIdTokenFor(again.cookies)).toBe(first.session?.sid)
        expect(posted).toEqual([])
    })

    test('as another user tells the chat\'s sign in that the session held has ended, and starts its own', async () => {
        const posted = clientsAnswer(answers(200))
        const held = await nextAuthSignIn('credentials', await createUserWithPassword('held'))
        const other = await nextAuthSignIn('credentials', await createUserWithPassword('other'), held.cookies)

        expect(other.session?.user?.username).toBe('test-sign-out-other')
        expect(other.session?.sid).toMatch(/^[A-Za-z0-9_-]{22}$/)
        expect(other.session?.sid).not.toBe(held.session?.sid)
        expect(posted.map(post => decode(post.logoutToken))).toMatchObject([{ aud: CHAT_CLIENT, sid: held.session?.sid }])
    })

    test('goes through when the chat\'s sign in is not told', async () => {
        const posted = clientsAnswer(refusesTheConnection)
        const logged = errorsLogged()
        const held = await signedIn('held-refused')
        const other = await nextAuthSignIn('credentials', await createUserWithPassword('other-refused'), held.cookies)

        expect(other.session?.user?.username).toBe('test-sign-out-other-refused')
        expect(posted).toHaveLength(1)
        expect(logged()).toContain('ECONNREFUSED')
    })

    test('tells no one of a company session, and a company user\'s is refused over a user\'s, which stays', async () => {
        const posted = clientsAnswer(answers(200))
        const company = await companySignedIn(await hashOfPassword)
        const user = await nextAuthSignIn('credentials', await createUserWithPassword('over-company'), company.cookies)
        expect(user.session?.user?.username).toBe('test-sign-out-over-company')
        expect(user.session?.sid).toMatch(/^[A-Za-z0-9_-]{22}$/)

        expect((await nextAuthSignIn('company-credentials', company.credentials)).session?.companyUser).not.toBeNull()
        expect((await nextAuthSignIn('company-credentials', company.credentials, user.cookies)).cookies).toEqual({})
        expect(posted).toEqual([])
    })
})
