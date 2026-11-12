import { POST as companyLogin } from '@/app/api/company-auth/login/route'
import { GET as authorize } from '@/app/api/oidc/authorize/route'
import { authOptions } from '@/auth/nextAuth/authOptions'
import { sessionTokenOf } from '@/auth/nextAuth/sessionToken'
import { hashAndEncryptPassword } from '@/auth/passwordHash'
import { sessionFromCookie } from '@/auth/sso/session'
import { DomainConfig } from '@/lib/sites/domainConfig'
import { DomainContext } from '@/lib/sites/context'
import { prisma } from '@/prisma-pn-client-instance'
import { testDomainConfig } from 'tests/testDomains'
import { afterAll, beforeAll, describe, expect, test } from '@jest/globals'
import { NextRequest } from 'next/server'
import type { NextResponse } from 'next/server'

/** A career site on its own domain, Omega's, and a domain set apart to sign in on. */
const withAuthDomain = DomainConfig.parse({
    'omega.ntnu.no': { site: 'OMEGAWEB', main: true },
    'contactor.no': { site: 'CAREERS', main: true },
    'login.omega.ntnu.no': { auth: true },
})

const SESSION_COOKIE = '__Secure-next-auth.session-token'
const PASSWORD = 'et-langt-nok-passord-123'
const EMAIL = 'innlogging@example.com'

let companyUserId: number

const headersOf = (url: string, cookies: Record<string, string>) => ({
    host: new URL(url).host,
    'x-forwarded-proto': 'https',
    cookie: Object.entries(cookies).map(([name, value]) => `${name}=${value}`).join('; '),
})

/** A login as the form sends it, over https to the host it came to. */
const login = (
    credentials: unknown,
    { origin = 'https://contactor.no', cookies = {} }: { origin?: string, cookies?: Record<string, string> } = {},
) => companyLogin(new NextRequest(`${origin}/api/company-auth/login`, {
    method: 'POST',
    headers: { ...headersOf(origin, cookies), 'content-type': 'application/json' },
    body: JSON.stringify(credentials),
}))

const sessionCookieOf = (response: NextResponse) => response.cookies.get(SESSION_COOKIE)?.value

const sessionOf = (origin: string, cookie: string) => sessionFromCookie(new NextRequest(`${origin}/`, {
    headers: headersOf(origin, { [SESSION_COOKIE]: cookie }),
}))

beforeAll(async () => {
    DomainContext.configure(withAuthDomain)
    const company = await prisma.company.create({ data: { name: 'Innloggingstest AS', description: '' } })
    const companyUser = await prisma.companyUser.create({
        data: {
            companyId: company.id,
            email: EMAIL,
            firstname: 'Kari',
            lastname: 'Nordmann',
            credentials: { create: { passwordHash: await hashAndEncryptPassword(PASSWORD) } },
        },
    })
    companyUserId = companyUser.id
})
afterAll(() => DomainContext.configure(testDomainConfig))

describe('the login of a company user', () => {
    test('the right email and password start a company session on the career domain', async () => {
        const response = await login({ email: 'Innlogging@Example.com', password: PASSWORD })
        expect(response.status).toBe(200)

        const cookie = sessionCookieOf(response)
        expect(cookie).toBeDefined()
        const session = await sessionOf('https://contactor.no', cookie ?? '')
        expect(session.user).toBeNull()
        expect(session.companyUser).toMatchObject({ id: companyUserId, company: { name: 'Innloggingstest AS' } })
        expect(session.memberships).toEqual([])
    })

    test('a wrong password, an unknown email and a body that is no login are refused alike', async () => {
        const responses = await Promise.all([
            login({ email: EMAIL, password: 'feil-passord-som-er-langt' }),
            login({ email: 'ingen@example.com', password: PASSWORD }),
            login({ email: EMAIL }),
            login('ikke en innlogging'),
        ])
        for (const response of responses) {
            expect(response.status).toBe(401)
            expect(await response.json()).toEqual({ error: 'CredentialsSignin' })
            expect(sessionCookieOf(response)).toBeUndefined()
        }
    })

    test('a deactivated company user, and one who has chosen no password, do not get in', async () => {
        const company = await prisma.company.findFirstOrThrow({ where: { name: 'Innloggingstest AS' } })
        await prisma.companyUser.create({
            data: {
                companyId: company.id,
                email: 'innlogging-deaktivert@example.com',
                firstname: 'Ola',
                lastname: 'Nordmann',
                active: false,
                credentials: { create: { passwordHash: await hashAndEncryptPassword(PASSWORD) } },
            },
        })
        await prisma.companyUser.create({
            data: {
                companyId: company.id,
                email: 'innlogging-uten@example.com',
                firstname: 'Per',
                lastname: 'Nordmann',
            },
        })

        expect((await login({ email: 'innlogging-deaktivert@example.com', password: PASSWORD })).status).toBe(401)
        expect((await login({ email: 'innlogging-uten@example.com', password: PASSWORD })).status).toBe(401)
    })

    test('it is refused when someone is signed in already, as a company user or as a user', async () => {
        const first = await login({ email: EMAIL, password: PASSWORD })
        const asCompanyUser = await login(
            { email: EMAIL, password: PASSWORD },
            { cookies: { [SESSION_COOKIE]: sessionCookieOf(first) ?? '' } },
        )
        expect(asCompanyUser.status).toBe(409)

        const user = await prisma.user.create({
            data: {
                username: 'test-company-login-user',
                email: 'test-company-login-user@test.test',
                bioParagraph: { create: {} },
                ledgerAccount: { create: { type: 'USER' } },
                credentials: { create: { passwordHash: 'x' } },
            },
        })
        const encode = authOptions.jwt?.encode
        if (!encode) throw new Error('no encoder')
        const userCookie = await encode({
            token: await sessionTokenOf(user.id, 'credentials'),
            secret: process.env.NEXTAUTH_SECRET ?? '',
        })
        const asUser = await login({ email: EMAIL, password: PASSWORD }, { cookies: { [SESSION_COOKIE]: userCookie } })
        expect(asUser.status).toBe(409)
        expect(sessionCookieOf(asUser)).toBeUndefined()
    })

    test('it is only there on a domain that serves the career site', async () => {
        const onAuthDomain = await login({ email: EMAIL, password: PASSWORD }, { origin: 'https://login.omega.ntnu.no' })
        expect(onAuthDomain.status).toBe(404)
        expect(sessionCookieOf(onAuthDomain)).toBeUndefined()

        // Omega's domain serves the career site under its base path.
        const onOmega = await login({ email: EMAIL, password: PASSWORD }, { origin: 'https://omega.ntnu.no' })
        expect(onOmega.status).toBe(200)
    })

    test('the provider hands no code to a company session, so it never reaches another domain', async () => {
        const signedIn = await login({ email: EMAIL, password: PASSWORD }, { origin: 'https://omega.ntnu.no' })
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
            headers: headersOf(origin, { [SESSION_COOKIE]: sessionCookieOf(signedIn) ?? '' }),
        }))

        const location = response.headers.get('location') ?? ''
        expect(location).not.toContain('code=')
        expect(location).toContain('/login')
    })
})
