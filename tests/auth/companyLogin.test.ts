import { GET as authorize } from '@/app/api/oidc/authorize/route'
import { authOptions } from '@/auth/nextAuth/authOptions'
import { authorizeCompanyCredentials, companyLoginErrors } from '@/auth/nextAuth/companyCredentials'
import { sessionTokenOf } from '@/auth/nextAuth/sessionToken'
import { hashAndEncryptPassword } from '@/auth/passwordHash'
import { sessionFromCookie } from '@/auth/sso/session'
import { DomainConfig } from '@/lib/sites/domainConfig'
import { DomainContext } from '@/lib/sites/context'
import { prisma } from '@/prisma-pn-client-instance'
import { testDomainConfig } from 'tests/testDomains'
import { afterAll, beforeAll, describe, expect, test } from '@jest/globals'
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
let companyUserId: number

const headersOf = (origin: string, cookies: Record<string, string> = {}) => ({
    host: new URL(origin).host,
    'x-forwarded-proto': 'https',
    cookie: Object.entries(cookies).map(([name, value]) => `${name}=${value}`).join('; '),
})

/** The sign in as NextAuth hands it to the provider: the credentials, and the headers of the request. */
const signIn = (
    credentials: { email: string, password: string },
    { origin = 'https://contactor.no', cookies = {} }: { origin?: string, cookies?: Record<string, string> } = {},
) => authorizeCompanyCredentials(credentials, { headers: headersOf(origin, cookies) })

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

    test('it is only there on a domain that serves the career site', async () => {
        await expect(signIn({ email: EMAIL, password: PASSWORD }, { origin: 'https://login.omega.ntnu.no' }))
            .rejects.toThrow(companyLoginErrors.notOnCareerSite)

        // Omega's domain serves the career site under its base path.
        await expect(signIn({ email: EMAIL, password: PASSWORD }, { origin: 'https://omega.ntnu.no' }))
            .resolves.toEqual({ id: String(companyUserId) })
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
