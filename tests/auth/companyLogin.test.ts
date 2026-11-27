import { GET as authorize } from '@/app/api/oidc/authorize/route'
import { GET as ssoStart } from '@/app/api/sso/start/route'
import { GET as nextAuth } from '@/app/api/auth/[...nextauth]/route'
import { authOptions } from '@/auth/nextAuth/authOptions'
import { authorizeCompanyCredentials, companyLoginErrors } from '@/auth/nextAuth/companyCredentials'
import { sessionTokenOf } from '@/auth/nextAuth/sessionToken'
import { hashAndEncryptPassword } from '@/auth/passwordHash'
import { sessionFromCookie } from '@/auth/sso/session'
import { companyLoginCallbackUrl } from '@/app/(careers)/career/(company-auth)/company-login/companyLoginCallbackUrl'
import { DomainConfig } from '@/lib/sites/domainConfig'
import { DomainContext } from '@/lib/sites/context'
import { prisma } from '@/prisma-pn-client-instance'
import { testDomainConfig } from 'tests/testDomains'
import { afterAll, beforeAll, describe, expect, jest, test } from '@jest/globals'
import { NextRequest } from 'next/server'
import type { JWT } from 'next-auth/jwt'

/** A career site on its own domain, Omega's, and a domain set apart to sign in on. */
const withAuthDomain = DomainConfig.parse({
    'omega.ntnu.no': { site: 'OMEGAWEB', main: true },
    'contactor.no': { site: 'CAREERS', main: true },
    'login.omega.ntnu.no': { auth: true },
})

const SESSION_COOKIE = '__Secure-next-auth.session-token'
const PASSWORD = 'et-langt-nok-passord-123'
const EMAIL = 'innlogging@example.com'

let companyId: number
let mockRequestHeaders = new Headers()

// NextAuth's route reads the request's headers and cookies from next/headers, which Next only fills
// for a request it serves itself.
jest.mock('next/headers', () => ({
    headers: () => Promise.resolve(mockRequestHeaders),
    cookies: () => Promise.resolve({ getAll: () => [] }),
}))
let companyUserId: number

const headersOf = (origin: string, cookies: Record<string, string> = {}) => ({
    host: new URL(origin).host,
    'x-forwarded-proto': 'https',
    cookie: Object.entries(cookies).map(([name, value]) => `${name}=${value}`).join('; '),
})

/** The sign in as NextAuth hands it to the provider: the credentials, and the headers of the request. */
const signIn = (
    credentials: { email: string, password: string },
    { cookies = {} }: { cookies?: Record<string, string> } = {},
) => authorizeCompanyCredentials(credentials, { headers: headersOf('https://contactor.no', cookies) })

/** The token NextAuth builds for whoever the provider let in, as its jwt callback does at a sign in. */
async function tokenAtSignIn(signedIn: { id: string }): Promise<JWT> {
    const jwt = authOptions.callbacks?.jwt
    if (!jwt) throw new Error('no jwt callback')
    return jwt({
        token: {} as JWT,
        user: signedIn,
        account: { provider: 'company-credentials', type: 'credentials', providerAccountId: signedIn.id },
        trigger: 'signIn',
    })
}

async function cookieOf(token: JWT): Promise<string> {
    const encode = authOptions.jwt?.encode
    if (!encode) throw new Error('no encoder')
    return encode({ token, secret: process.env.NEXTAUTH_SECRET ?? '' })
}

async function createCompanyUser(email: string, { active = true, withPassword = true } = {}) {
    return prisma.companyUser.create({
        data: {
            companyId,
            email,
            firstname: 'Kari',
            lastname: 'Nordmann',
            active,
            credentials: withPassword ? { create: { passwordHash: await hashAndEncryptPassword(PASSWORD) } } : undefined,
        },
    })
}

beforeAll(async () => {
    DomainContext.configure(withAuthDomain)
    const company = await prisma.company.create({ data: { name: 'Innloggingstest AS', description: '' } })
    companyId = company.id
    companyUserId = (await createCompanyUser(EMAIL)).id
})
afterAll(() => DomainContext.configure(testDomainConfig))

describe('the login of a company user', () => {
    test('the right email and password sign in as the company user, and give a company session', async () => {
        const signedIn = await signIn({ email: 'Innlogging@Example.com', password: PASSWORD })
        expect(signedIn).toEqual({ id: String(companyUserId) })
        if (!signedIn) return

        const token = await tokenAtSignIn(signedIn)
        expect(token.provider).toBe('company-credentials')

        // The session the cookie NextAuth writes for it gives, read the way every request reads it.
        const origin = 'https://contactor.no'
        const session = await sessionFromCookie(new NextRequest(`${origin}/`, {
            headers: headersOf(origin, { [SESSION_COOKIE]: await cookieOf(token) }),
        }))
        expect(session.user).toBeNull()
        expect(session.companyUser).toMatchObject({ id: companyUserId, company: { name: 'Innloggingstest AS' } })
        expect(session.memberships).toEqual([])
    })

    test('a wrong password, an unknown email and no credentials sign in as no one', async () => {
        await expect(signIn({ email: EMAIL, password: 'feil-passord-som-er-langt' })).resolves.toBeNull()
        await expect(signIn({ email: 'ingen@example.com', password: PASSWORD })).resolves.toBeNull()
        await expect(signIn({ email: EMAIL, password: '' })).resolves.toBeNull()
        await expect(authorizeCompanyCredentials(undefined, { headers: headersOf('https://contactor.no') }))
            .resolves.toBeNull()
    })

    test('a deactivated company user, and one who has chosen no password, do not get in', async () => {
        await createCompanyUser('innlogging-deaktivert@example.com', { active: false })
        await createCompanyUser('innlogging-uten@example.com', { withPassword: false })

        await expect(signIn({ email: 'innlogging-deaktivert@example.com', password: PASSWORD })).resolves.toBeNull()
        await expect(signIn({ email: 'innlogging-uten@example.com', password: PASSWORD })).resolves.toBeNull()
    })

    test('it is refused when someone is signed in already, as a company user or as a user', async () => {
        const companyCookie = await cookieOf(await tokenAtSignIn({ id: String(companyUserId) }))
        await expect(signIn({ email: EMAIL, password: PASSWORD }, { cookies: { [SESSION_COOKIE]: companyCookie } }))
            .rejects.toThrow(companyLoginErrors.alreadySignedIn)

        const user = await prisma.user.create({
            data: {
                username: 'test-company-login-user',
                email: 'test-company-login-user@test.test',
                bioParagraph: { create: {} },
                ledgerAccount: { create: { type: 'USER' } },
                credentials: { create: { passwordHash: 'x' } },
            },
        })
        const userCookie = await cookieOf(await sessionTokenOf(user.id, 'credentials'))
        await expect(signIn({ email: EMAIL, password: PASSWORD }, { cookies: { [SESSION_COOKIE]: userCookie } }))
            .rejects.toThrow(companyLoginErrors.alreadySignedIn)
    })

    test('the sign in callback lets a company user through without looking for a user', async () => {
        const signInCallback = authOptions.callbacks?.signIn
        if (!signInCallback) throw new Error('no signIn callback')
        const user = { id: String(companyUserId) } as Parameters<typeof signInCallback>[0]['user']

        await expect(signInCallback({
            user,
            account: { provider: 'company-credentials', type: 'credentials', providerAccountId: user.id },
        })).resolves.toBe(true)
    })

    test('the provider hands no code to a company session, so it never reaches another domain', async () => {
        const cookie = await cookieOf(await tokenAtSignIn({ id: String(companyUserId) }))
        const origin = 'https://login.omega.ntnu.no'
        const query = new URLSearchParams({
            response_type: 'code',
            client_id: 'contactor.no',
            redirect_uri: 'https://contactor.no/api/sso/callback',
            scope: 'openid',
            state: 'state',
            code_challenge: 'x'.repeat(43),
            code_challenge_method: 'S256',
        })
        const response = await authorize(new NextRequest(`${origin}/api/oidc/authorize?${query.toString()}`, {
            headers: headersOf(origin, { [SESSION_COOKIE]: cookie }),
        }))

        const location = response.headers.get('location') ?? ''
        expect(location).not.toContain('code=')
        expect(location).toContain('/login')
    })
})

describe('where the logins are offered', () => {
    /** The providers NextAuth's route lists on a host, which next-auth/react's `signIn` looks a provider up in. */
    async function providersOn(host: string): Promise<string[]> {
        const origin = `https://${host}`
        const request = new NextRequest(`${origin}/api/auth/providers`, { headers: headersOf(origin) })
        mockRequestHeaders = request.headers
        const context = { params: Promise.resolve({ nextauth: ['providers'] }) }
        const response = await (nextAuth(request, context) as Promise<Response>)
        return Object.keys(await response.json() as object)
    }

    test('a company user signs in on the domains that serve the career site, a user on the auth domain alone', async () => {
        expect(await providersOn('contactor.no')).toEqual(['company-credentials'])
        expect(await providersOn('omega.ntnu.no')).toEqual(['company-credentials'])
        expect(await providersOn('login.omega.ntnu.no')).toEqual(['credentials', 'feide'])
    })

    test('without a dedicated auth domain, Omega\'s domain offers them all', async () => {
        DomainContext.configure(DomainConfig.parse({
            'omega.ntnu.no': { site: 'OMEGAWEB', main: true },
            'contactor.no': { site: 'CAREERS', main: true },
        }))
        try {
            expect(await providersOn('omega.ntnu.no')).toEqual(['credentials', 'company-credentials', 'feide'])
            expect(await providersOn('contactor.no')).toEqual(['company-credentials'])
        } finally {
            DomainContext.configure(withAuthDomain)
        }
    })

    test('a company session is no user\'s, so the sign in of a site starts as for a visitor', async () => {
        const cookie = await cookieOf(await tokenAtSignIn({ id: String(companyUserId) }))
        const origin = 'https://contactor.no'
        const response = await ssoStart(new NextRequest(`${origin}/api/sso/start?callbackUrl=%2Fcareer%2Fprofile`, {
            headers: headersOf(origin, { [SESSION_COOKIE]: cookie }),
        }))

        const location = new URL(response.headers.get('location') ?? '')
        expect(location.origin + location.pathname).toBe('https://login.omega.ntnu.no/api/oidc/authorize')
    })
})

describe('the page the company login lands on', () => {
    const landing = (callbackUrl: string) => companyLoginCallbackUrl({ callbackUrl })

    test('is a page of the career site', () => {
        expect(landing('/career/job-ads/stilling-12')).toBe('/career/job-ads/stilling-12')
        expect(landing('/career')).toBe('/career')
        expect(landing('/career/companies?company-name=a#b')).toBe('/career/companies?company-name=a#b')
        expect(landing('/career#jobs')).toBe('/career#jobs')
        expect(companyLoginCallbackUrl({})).toBeNull()
    })

    test('is nothing that leaves the app or the career site, so the login lands on the frontpage', () => {
        const refused = [
            'https://evil.example/career', '//evil.example/career', '/\\evil.example/career', '/%2F%2Fevil.example',
            '/users/me', '/revue', '/careers', '/career/../admin', '/career\\..\\admin', '/career/%2e%2e/admin',
            '/career%2F..%2Fadmin', 'career/job-ads',
        ]
        refused.forEach(callbackUrl => expect(landing(callbackUrl)).toBeNull())
    })
})
