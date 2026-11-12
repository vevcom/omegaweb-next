import { domainContextOf } from '@/app/domainContextOfRequest'
import { readSessionToken, startCompanySession } from '@/auth/sso/session'
import { companyUserIdOfCredentials } from '@/services/careers/companies/users/account/credentials'
import { companyUserAccountSchemas } from '@/services/careers/companies/users/account/schemas'
import { Site } from '@/lib/sites/site'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const refuse = (error: string, status: number) => NextResponse.json({ error }, { status })

/**
 * Signs a company user in with their email and password. A company user signs in here and nowhere
 * else: on a domain that serves the career site, and only when nobody is signed in on it already.
 * The session is started on the domain the request came to and is never taken to another.
 *
 * The body is JSON, which a form on another site cannot send, so a visitor is not signed in as
 * someone else by a page they did not mean to submit.
 */
export async function POST(request: NextRequest) {
    if (!domainContextOf(request).serves(Site.CAREERS)) return refuse('NotFound', 404)
    if (await readSessionToken(request)) return refuse('AlreadySignedIn', 409)

    const body: unknown = await request.json().catch(() => null)
    const credentials = companyUserAccountSchemas.data.login.safeParse(body)
    if (!credentials.success) return refuse('CredentialsSignin', 401)

    const companyUserId = await companyUserIdOfCredentials(credentials.data.email, credentials.data.password)
    if (companyUserId === null) return refuse('CredentialsSignin', 401)

    const response = NextResponse.json({ ok: true })
    await startCompanySession(response, request, companyUserId)
    return response
}
