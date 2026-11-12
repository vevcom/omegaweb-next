import { oidcOperations } from '@/services/auth/oidc/operations'
import { isPostLogoutRedirectUri, oidcClientOf } from '@/services/auth/oidc/clients'
import { discoveryDocument } from '@/services/auth/oidc/discovery'
import { OIDC_CLAIMS, OIDC_MAIL_SCOPE, OIDC_SCOPES, oidcScopes, scopesFor, userClaims } from '@/services/auth/oidc/scopes'
import { jwks, signAccessToken, signIdToken, verifyAccessToken } from '@/services/auth/oidc/tokens'
import { GET as userinfo } from '@/app/api/oidc/userinfo/route'
import { userOperations } from '@/services/users/operations'
import { aliasOperations } from '@/services/mail/alias/operations'
import { mailingListOperations } from '@/services/mail/list/operations'
import { mailOperations } from '@/services/mail/operations'
import { prisma } from '@/prisma-pn-client-instance'
import { Session } from '@/auth/session/Session'
import { Site } from '@/lib/sites/site'
import { afterEach, describe, expect, test } from '@jest/globals'
import { decode } from 'jsonwebtoken'
import { NextRequest } from 'next/server'
import { createHash, randomBytes } from 'node:crypto'
import type { oidcSchemas } from '@/services/auth/oidc/schemas'
import type { z } from 'zod'

// The one domain the tests run with, see tests/testDomains.ts: Omega's, which is also the issuer.
const ISSUER = 'https://omega.ntnu.no'
const CLIENT = 'omega.ntnu.no'
const REDIRECT_URI = `${ISSUER}/api/sso/callback`
// The webmail of .env.default, which the tests run with: its host is the client and the mailbox domain.
const WEBMAIL = 'http://mail.omegaweb.localhost:8081'
const WEBMAIL_CLIENT = 'mail.omegaweb.localhost'

const hashOf = (value: string) => createHash('sha256').update(value).digest('base64url')

async function createUser(name: string) {
    const created = await prisma.user.create({
        data: {
            username: `test-oidc-${name}`,
            email: `test-oidc-${name}@test.test`,
            firstname: 'Ola',
            lastname: 'Nordmann',
            bioParagraph: { create: {} },
            ledgerAccount: { create: { type: 'USER' } },
        },
    })
    const user = await userOperations.read({ params: { id: created.id }, bypassAuth: true })
    return { user, session: Session.fromJsObject({ user, permissions: [], memberships: [] }) }
}

/** A PKCE pair, RFC 7636: the verifier the client keeps and the challenge it sends. */
function pkce() {
    const verifier = randomBytes(32).toString('base64url')
    return { verifier, challenge: hashOf(verifier) }
}

type IssueParams = z.input<typeof oidcSchemas.params.issueCode>

type Actor = { user: { id: number } | null, session: Session<'HAS_USER'> | Session<'NO_USER'> }

const issue = ({ user, session }: Actor, challenge: string, overrides: Partial<IssueParams> = {}) =>
    oidcOperations.issueCode({
        params: {
            userId: user?.id ?? 0,
            clientId: CLIENT,
            redirectUri: REDIRECT_URI,
            responseType: 'code',
            scope: 'openid profile email',
            state: 'state-1',
            nonce: 'nonce-1',
            codeChallenge: challenge,
            codeChallengeMethod: 'S256',
            provider: 'credentials',
            ...overrides,
        },
        session,
    })

const exchange = (code: string, verifier: string, overrides: { clientId?: string, redirectUri?: string } = {}) =>
    oidcOperations.exchangeCode({
        params: { clientId: CLIENT, redirectUri: REDIRECT_URI, code, codeVerifier: verifier, ...overrides },
    })

const refused = (call: Promise<unknown>, errorCode: string) => expect(call).rejects.toMatchObject({ errorCode })

/** An alias whose one mailing list the user is on, so the user receives its mail. */
async function createAliasReceivedBy(userId: number, localPart: string) {
    const alias = await aliasOperations.create({
        data: { localPart, domain: 'omega.ntnu.no', description: '' },
        bypassAuth: true,
    })
    const list = await mailingListOperations.create({
        data: { name: `${localPart}-list`, description: '' },
        bypassAuth: true,
    })
    await mailOperations.createAliasMailingListRelation({
        data: { mailAliasId: alias.id, mailingListId: list.id },
        bypassAuth: true,
    })
    await mailOperations.createMailingListUserRelation({ data: { userId, mailingListId: list.id }, bypassAuth: true })
    return alias
}

afterEach(async () => {
    await prisma.mailAlias.deleteMany({ where: { address: { startsWith: 'test-oidc-' } } })
    await prisma.mailAddress.deleteMany({ where: { address: { startsWith: 'test-oidc-' } } })
    await prisma.mailingList.deleteMany({ where: { name: { startsWith: 'test-oidc-' } } })
    await prisma.user.deleteMany({ where: { username: { startsWith: 'test-oidc-' } } })
})

describe('the OpenID Connect provider', () => {
    test('issues a code the client exchanges once, proving it with the verifier', async () => {
        const actor = await createUser('once')
        const { user } = actor
        const { verifier, challenge } = pkce()
        const issued = await issue(actor, challenge)
        // The answer is where the browser goes: back to the client with the code and its state.
        expect(issued).toMatchObject({ state: 'state-1', redirectUri: REDIRECT_URI })
        const { code } = issued
        expect(code).toMatch(/^[A-Za-z0-9_-]{43}$/)
        // Stored hashed, so the table never holds a usable code.
        expect(await prisma.oidcAuthorizationCode.findUnique({ where: { codeHash: hashOf(code) } })).toMatchObject({
            userId: user.id,
            clientId: CLIENT,
            scope: 'openid profile email',
            nonce: 'nonce-1',
            provider: 'credentials',
        })

        await expect(exchange(code, verifier)).resolves.toEqual({
            userId: user.id,
            provider: 'credentials',
            clientId: CLIENT,
            scopes: ['openid', 'profile', 'email'],
            nonce: 'nonce-1',
        })
        await refused(exchange(code, verifier), 'DISSALLOWED')
    })

    test('ignores scopes it does not know, and refuses a request without openid', async () => {
        const actor = await createUser('scopes')
        const { verifier, challenge } = pkce()
        const { code } = await issue(actor, challenge, { scope: 'openid offline_access email', nonce: null })
        await expect(exchange(code, verifier)).resolves.toMatchObject({ scopes: ['openid', 'email'], nonce: null })
        await refused(issue(actor, challenge, { scope: 'profile email' }), 'BAD PARAMETERS')
    })

    test('gives the mail scope to the webmail alone', async () => {
        const actor = await createUser('mail-scope')
        const forSite = pkce()
        const { code: siteCode } = await issue(actor, forSite.challenge, { scope: `openid ${OIDC_MAIL_SCOPE}` })
        await expect(exchange(siteCode, forSite.verifier)).resolves.toMatchObject({ scopes: ['openid'] })

        const forWebmail = pkce()
        const webmail = { clientId: WEBMAIL_CLIENT, redirectUri: `${WEBMAIL}/en/auth/callback` }
        const { code } = await issue(actor, forWebmail.challenge, { ...webmail, scope: `openid ${OIDC_MAIL_SCOPE}` })
        await expect(exchange(code, forWebmail.verifier, webmail)).resolves.toMatchObject({
            clientId: WEBMAIL_CLIENT,
            scopes: ['openid', OIDC_MAIL_SCOPE],
        })
    })

    test('refuses a code to an unknown client, to an unregistered redirect uri, and to a plain challenge', async () => {
        const actor = await createUser('clients')
        const { challenge } = pkce()
        await refused(issue(actor, challenge, { clientId: 'evil.example' }), 'BAD PARAMETERS')
        await refused(issue(actor, challenge, { redirectUri: `${ISSUER}/elsewhere` }), 'BAD PARAMETERS')
        await refused(issue(actor, challenge, { codeChallengeMethod: 'plain' }), 'BAD PARAMETERS')
        await refused(issue(actor, challenge, { codeChallenge: 'short' }), 'BAD PARAMETERS')
        await refused(issue(actor, challenge, { responseType: 'token' }), 'BAD PARAMETERS')
        await refused(issue(actor, challenge, { state: '' }), 'BAD PARAMETERS')
        // A parameter that was not on the wire at all is refused by its wire name, which the routes pass on.
        await expect(issue(actor, challenge, { redirectUri: null })).rejects.toMatchObject({
            parseError: { error: { issues: [
                expect.objectContaining({ path: ['redirectUri'], message: 'redirect_uri is required' }),
            ] } },
        })
    })

    test('the token endpoint trades the code for the tokens, and takes the one grant type', async () => {
        const actor = await createUser('token-endpoint')
        const { verifier, challenge } = pkce()
        const { code } = await issue(actor, challenge, { scope: 'openid email' })
        const grant = { clientId: CLIENT, redirectUri: REDIRECT_URI, code, codeVerifier: verifier }
        await refused(oidcOperations.token({ data: { ...grant, grantType: 'client_credentials' } }), 'BAD DATA')
        const tokens = await oidcOperations.token({ data: { ...grant, grantType: 'authorization_code' } })
        expect(tokens).toMatchObject({ token_type: 'Bearer', expires_in: 3600, scope: 'openid email' })
        expect(decode(tokens.id_token)).toMatchObject({ aud: CLIENT, sub: String(actor.user.id), nonce: 'nonce-1' })
        expect(verifyAccessToken(tokens.access_token)).toMatchObject({ userId: actor.user.id, scopes: ['openid', 'email'] })

        // The userinfo endpoint answers that token with the claims, and nothing else.
        await expect(oidcOperations.userinfo({ params: { accessToken: tokens.access_token } }))
            .resolves.toEqual({ sub: String(actor.user.id), email: actor.user.email })
        await refused(oidcOperations.userinfo({ params: { accessToken: `${tokens.access_token}x` } }), 'JWT INVALID')
    })

    test('a logged out visitor is sent to the uri asked for when it is ours, and to the frontpage otherwise', async () => {
        const endSession = (postLogoutRedirectUri: string | null) =>
            oidcOperations.endSession({ params: { postLogoutRedirectUri } })
        await expect(endSession(`${ISSUER}/career`)).resolves.toEqual({ redirectTo: `${ISSUER}/career` })
        await expect(endSession('https://evil.example/')).resolves.toEqual({ redirectTo: `${ISSUER}/` })
        await expect(endSession(null)).resolves.toEqual({ redirectTo: `${ISSUER}/` })
    })

    test('issues a code to the signed in user, for themselves alone', async () => {
        const anonymous = Session.fromJsObject({ user: null, permissions: [], memberships: [] })
        await refused(issue({ user: null, session: anonymous }, pkce().challenge), 'UNAUTHENTICATED')
        const actor = await createUser('self')
        const other = await createUser('other')
        await refused(issue({ user: other.user, session: actor.session }, pkce().challenge), 'UNAUTHORIZED')
    })

    test('refuses an exchange by another client, to another uri, with a wrong verifier, or of an expired code', async () => {
        const actor = await createUser('exchange')
        const fresh = async () => {
            const pair = pkce()
            return { ...pair, code: (await issue(actor, pair.challenge)).code }
        }

        const byOther = await fresh()
        await refused(exchange(byOther.code, byOther.verifier, { clientId: 'evil.example' }), 'DISSALLOWED')
        const toOther = await fresh()
        await refused(exchange(toOther.code, toOther.verifier, { redirectUri: `${ISSUER}/elsewhere` }), 'DISSALLOWED')
        const wrongVerifier = await fresh()
        await refused(exchange(wrongVerifier.code, pkce().verifier), 'DISSALLOWED')
        await refused(exchange('no-such-code', pkce().verifier), 'DISSALLOWED')
        // A refused exchange spends the code too.
        await refused(exchange(wrongVerifier.code, wrongVerifier.verifier), 'DISSALLOWED')

        const expired = await fresh()
        await prisma.oidcAuthorizationCode.updateMany({
            where: { userId: actor.user.id },
            data: { expiresAt: new Date(Date.now() - 1000) },
        })
        await refused(exchange(expired.code, expired.verifier), 'DISSALLOWED')
    })

    test('sweeps expired codes out as it issues a new one', async () => {
        const actor = await createUser('sweep')
        await issue(actor, pkce().challenge)
        await prisma.oidcAuthorizationCode.updateMany({
            where: { userId: actor.user.id },
            data: { expiresAt: new Date(Date.now() - 1000) },
        })
        await issue(actor, pkce().challenge)
        expect(await prisma.oidcAuthorizationCode.count({ where: { userId: actor.user.id } })).toBe(1)
    })

    test('the clients are the sites\' domains, taking the code back at their SSO callback', () => {
        const client = oidcClientOf(CLIENT)
        expect(client).toMatchObject({
            id: CLIENT, kind: 'site', site: Site.OMEGAWEB, scopes: ['openid', 'profile', 'email'],
        })
        expect(scopesFor('site')).toEqual(['openid', 'profile', 'email'])
        expect(scopesFor('webmail')).toEqual(['openid', 'profile', 'email', OIDC_MAIL_SCOPE])
        expect(client?.acceptsRedirectUri(REDIRECT_URI)).toBe(true)
        expect(client?.acceptsRedirectUri(`${ISSUER}/elsewhere`)).toBe(false)
        // A domain of Omega's serves every site, so the login may render as any of them.
        expect(client?.rendersSite(Site.CAREERS)).toBe(true)
        expect(oidcClientOf('contactor.no')).toBeNull()
        expect(isPostLogoutRedirectUri(`${ISSUER}/`)).toBe(true)
        expect(isPostLogoutRedirectUri(`${ISSUER}/career`)).toBe(true)
        expect(isPostLogoutRedirectUri('https://evil.example/')).toBe(false)
        expect(isPostLogoutRedirectUri('not a url')).toBe(false)
    })

    test('the webmail is a client too, taking the code back under any locale, and the one given the mail scope', () => {
        const client = oidcClientOf(WEBMAIL_CLIENT)
        expect(client).toMatchObject({
            id: WEBMAIL_CLIENT, kind: 'webmail', site: Site.OMEGAWEB, scopes: scopesFor('webmail'),
        })
        expect(client?.acceptsRedirectUri(`${WEBMAIL}/en/auth/callback`)).toBe(true)
        expect(client?.acceptsRedirectUri(`${WEBMAIL}/nb-NO/auth/callback`)).toBe(true)
        expect(client?.acceptsRedirectUri(`${WEBMAIL}/auth/callback`)).toBe(false)
        expect(client?.acceptsRedirectUri(`${WEBMAIL}/en/auth/callback?next=x`)).toBe(false)
        expect(client?.acceptsRedirectUri(`https://${WEBMAIL_CLIENT}:8081/en/auth/callback`)).toBe(false)
        expect(client?.acceptsRedirectUri(`${ISSUER}/en/auth/callback`)).toBe(false)
        // The webmail has no site of its own, so the login renders as Omega's.
        expect(client?.rendersSite(Site.CAREERS)).toBe(false)
        expect(isPostLogoutRedirectUri(`${WEBMAIL}/`)).toBe(true)
    })

    test('signs tokens the published key verifies, naming the key by the id the JWKS gives it', async () => {
        const { user } = await createUser('tokens')
        const { keys } = jwks()
        expect(keys).toHaveLength(1)
        expect(keys[0]).toMatchObject({ kty: 'EC', crv: 'P-256', alg: 'ES256', use: 'sig' })
        expect(keys[0].kid).toMatch(/^[A-Za-z0-9_-]{43}$/)

        const accessToken = signAccessToken({
            clientId: CLIENT, userId: user.id, scopes: ['openid', 'email'], claims: { email: user.email, groups: ['a@b'] },
        })
        expect(decode(accessToken, { complete: true })?.header)
            .toMatchObject({ alg: 'ES256', typ: 'at+jwt', kid: keys[0].kid })
        // The client is among the audiences, which is what the mail server is told to accept a token by.
        expect(decode(accessToken)).toMatchObject({
            iss: ISSUER, aud: [ISSUER, CLIENT], sub: String(user.id), email: user.email, groups: ['a@b'],
        })
        expect(verifyAccessToken(accessToken)).toEqual({ userId: user.id, clientId: CLIENT, scopes: ['openid', 'email'] })
        expect(() => verifyAccessToken(`${accessToken}x`)).toThrow()

        // A key the server lacks or cannot read is not the bearer's fault, so it is no JWT INVALID.
        const errorCodeOf = (run: () => unknown) => {
            try {
                run()
                return null
            } catch (error) {
                return (error as { errorCode?: string }).errorCode ?? 'not a service error'
            }
        }
        expect(errorCodeOf(() => verifyAccessToken(`${accessToken}x`))).toBe('JWT INVALID')
        const publicKey = process.env.JWT_PUBLIC_KEY
        try {
            Reflect.deleteProperty(process.env, 'JWT_PUBLIC_KEY')
            expect(errorCodeOf(() => verifyAccessToken(accessToken))).toBe('INVALID CONFIGURATION')
            process.env.JWT_PUBLIC_KEY = 'not a key'
            expect(errorCodeOf(() => verifyAccessToken(accessToken))).toBe('INVALID CONFIGURATION')
        } finally {
            process.env.JWT_PUBLIC_KEY = publicKey
        }

        const claims = await userClaims(user.id, ['openid', 'profile', 'email'])
        const idToken = signIdToken({ clientId: CLIENT, userId: user.id, nonce: 'nonce-1', claims })
        expect(decode(idToken, { complete: true })?.header).toMatchObject({ alg: 'ES256', kid: keys[0].kid })
        expect(decode(idToken)).toMatchObject({
            iss: ISSUER,
            aud: CLIENT,
            sub: String(user.id),
            nonce: 'nonce-1',
            preferred_username: user.username,
            name: 'Ola Nordmann',
            given_name: 'Ola',
            family_name: 'Nordmann',
            email: user.email,
        })
    })

    test('gives the claims the scopes ask for and no others', async () => {
        const { user } = await createUser('claims')
        expect(await userClaims(user.id, ['openid'])).toEqual({})
        expect(await userClaims(user.id, ['openid', 'email'])).toEqual({ email: user.email })
        expect(Object.keys(await userClaims(user.id, ['openid', 'profile']))).toEqual([
            'preferred_username', 'name', 'given_name', 'family_name',
        ])
    })

    test('the mail scope gives no claim: which mailboxes a user may open is not in the token', async () => {
        const { user } = await createUser('groups')
        await createAliasReceivedBy(user.id, 'test-oidc-styret')

        expect(await userClaims(user.id, ['openid', OIDC_MAIL_SCOPE])).toEqual({})
    })

    test('userinfo blames a bad token on the bearer and a failure of its own on the server', async () => {
        const ask = (token: string) => userinfo(new NextRequest(`${ISSUER}/api/oidc/userinfo`, {
            headers: { host: new URL(ISSUER).host, 'x-forwarded-proto': 'https', authorization: `Bearer ${token}` },
        }))
        const badToken = await ask('not-a-token')
        expect(badToken.status).toBe(401)
        expect(badToken.headers.get('www-authenticate')).toMatch(/^Bearer error="invalid_token"/)

        const publicKey = process.env.JWT_PUBLIC_KEY
        try {
            Reflect.deleteProperty(process.env, 'JWT_PUBLIC_KEY')
            const broken = await ask('not-a-token')
            expect(broken.status).toBe(500)
            expect(broken.headers.get('www-authenticate')).toBeNull()
            expect(await broken.text()).toBe('')
        } finally {
            process.env.JWT_PUBLIC_KEY = publicKey
        }
    })

    test('the discovery document names the endpoints on the issuer', () => {
        expect(discoveryDocument()).toMatchObject({
            issuer: ISSUER,
            authorization_endpoint: `${ISSUER}/api/oidc/authorize`,
            token_endpoint: `${ISSUER}/api/oidc/token`,
            userinfo_endpoint: `${ISSUER}/api/oidc/userinfo`,
            jwks_uri: `${ISSUER}/api/oidc/jwks`,
            end_session_endpoint: `${ISSUER}/api/oidc/end-session`,
            response_types_supported: ['code'],
            code_challenge_methods_supported: ['S256'],
            id_token_signing_alg_values_supported: ['ES256'],
        })
        // The scopes and the claims it lists are the table's: the mail scope so the webmail asks for it, and groups.
        expect(discoveryDocument().scopes_supported).toEqual(OIDC_SCOPES)
        expect(discoveryDocument().claims_supported).toEqual(OIDC_CLAIMS)
        expect(OIDC_SCOPES).toEqual(['openid', 'profile', 'email', OIDC_MAIL_SCOPE])
        expect(OIDC_CLAIMS).toEqual(['sub', ...Object.values(oidcScopes).flatMap(scope => Object.keys(scope.claims))])
        expect(OIDC_CLAIMS).not.toContain('groups')
    })
})
