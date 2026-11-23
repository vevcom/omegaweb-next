import '@ow-server-only'
import { readSessionToken } from '@/auth/sso/session'
import { companyUserIdOfCredentials } from '@/services/careers/companies/users/auth/credentials'
import { NextRequest } from 'next/server'

/** The id of the login of company users among NextAuth's providers, and the provider a company session names. */
export const COMPANY_CREDENTIALS_PROVIDER = 'company-credentials'

/**
 * What the company login refuses with, apart from wrong credentials: NextAuth hands the message of
 * an error thrown in `authorize` to the form as the error of the sign in.
 */
export const companyLoginErrors = {
    alreadySignedIn: 'AlreadySignedIn',
} as const

/** The request of a sign in as NextAuth hands it to `authorize`: its headers and little else. */
type AuthorizeRequest = { headers?: Record<string, unknown> }

/** The request as the rest of the app reads one, built from the headers the proxy stamped on it. */
function requestOf({ headers = {} }: AuthorizeRequest): NextRequest {
    const stringHeaders = Object.entries(headers).flatMap(
        ([name, value]): [string, string][] => (typeof value === 'string' ? [[name, value]] : [])
    )
    const host = stringHeaders.find(([name]) => name.toLowerCase() === 'host')?.[1] ?? 'localhost'
    return new NextRequest(`https://${host}/`, { headers: stringHeaders })
}

/**
 * The `authorize` of the company login: the company user an email and a password sign in as, null
 * for wrong credentials. A company user signs in only when nobody is signed in on the domain
 * already, so the sign in is refused otherwise, whatever the credentials. Where it is offered at all
 * is said by `loginProviders`.
 */
export async function authorizeCompanyCredentials(
    credentials: Record<'email' | 'password', string> | undefined,
    authorizeRequest: AuthorizeRequest,
): Promise<{ id: string } | null> {
    const request = requestOf(authorizeRequest)
    if (await readSessionToken(request)) throw new Error(companyLoginErrors.alreadySignedIn)

    if (!credentials?.email || !credentials.password) return null
    const companyUserId = await companyUserIdOfCredentials(credentials.email, credentials.password)
    return companyUserId === null ? null : { id: String(companyUserId) }
}
