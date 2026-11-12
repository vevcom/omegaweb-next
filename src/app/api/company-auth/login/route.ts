import { domainContextOf } from '@/app/domainContextOfRequest'
import { readSessionToken, startCompanySession } from '@/auth/sso/session'
import { companyUserIdOfCredentials } from '@/services/careers/companies/users/auth/credentials'
import { companyUserAuthSchemas } from '@/services/careers/companies/users/auth/schemas'
import { Site } from '@/lib/sites/site'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const refuse = (error: string, status: number) => NextResponse.json({ error }, { status })

/**
 * Whether the request is one the login form sent: a JSON body, from a page of the domain it came
 * to. A form on another site can send neither. It cannot set the content type to JSON, though it
 * can write a text/plain body that parses as JSON, and the browser names the site it is on in the
 * Origin header. Without this, a page a visitor did not mean to submit could sign them in as
 * someone else's company user.
 */
function isFromLoginForm(request: NextRequest, domain: string): boolean {
    const contentType = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()
    if (contentType !== 'application/json') return false

    // A browser sends Origin with every POST. What sends none is no browser, and holds no visitor's cookies.
    const origin = request.headers.get('origin')
    if (origin === null) return true
    return URL.canParse(origin) && new URL(origin).host === domain
}

/**
 * Signs a company user in with their email and password. A company user signs in here and nowhere
 * else: on a domain that serves the career site, and only when nobody is signed in on it already.
 * The session is started on the domain the request came to and is never taken to another.
 */
export async function POST(request: NextRequest) {
    const context = domainContextOf(request)
    if (!context.serves(Site.CAREERS)) return refuse('NotFound', 404)
    if (!isFromLoginForm(request, context.domain)) return refuse('Forbidden', 403)
    if (await readSessionToken(request)) return refuse('AlreadySignedIn', 409)

    const body: unknown = await request.json().catch(() => null)
    const credentials = companyUserAuthSchemas.data.login.safeParse(body)
    if (!credentials.success) return refuse('CredentialsSignin', 401)

    const companyUserId = await companyUserIdOfCredentials(credentials.data.email, credentials.data.password)
    if (companyUserId === null) return refuse('CredentialsSignin', 401)

    const response = NextResponse.json({ ok: true })
    await startCompanySession(response, request, companyUserId)
    return response
}
