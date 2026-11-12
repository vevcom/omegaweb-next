/** The route that signs a company user in. App-wide, so it runs on the domain the visitor is on. */
export const COMPANY_LOGIN_PATH = '/api/company-auth/login'

export type CompanyLoginError = 'CredentialsSignin' | 'AlreadySignedIn' | 'Default'

/**
 * Signs a company user in on the domain the browser is on, with their email and password. Returns
 * null when they are signed in, and what went wrong otherwise.
 */
export async function signInAsCompanyUser(email: string, password: string): Promise<CompanyLoginError | null> {
    try {
        const response = await fetch(COMPANY_LOGIN_PATH, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email, password }),
        })
        if (response.ok) return null
        const body: unknown = await response.json().catch(() => null)
        const error = typeof body === 'object' && body !== null && 'error' in body ? body.error : null
        return error === 'CredentialsSignin' || error === 'AlreadySignedIn' ? error : 'Default'
    } catch {
        return 'Default'
    }
}
