import { signIn } from 'next-auth/react'

export type CompanyLoginError = 'CredentialsSignin' | 'AlreadySignedIn' | 'NotOnCareerSite' | 'Default'

const knownErrors: readonly string[] = ['CredentialsSignin', 'AlreadySignedIn', 'NotOnCareerSite']

/**
 * Signs a company user in on the domain the browser is on, with their email and password, through
 * the provider NextAuth has for them. Returns null when they are signed in, and what went wrong
 * otherwise.
 */
export async function signInAsCompanyUser(email: string, password: string): Promise<CompanyLoginError | null> {
    try {
        // Without the redirect, a failed attempt never navigates.
        const result = await signIn('company-credentials', { email, password, redirect: false })
        if (result?.ok && !result.error) return null
        return knownErrors.includes(result?.error ?? '') ? result?.error as CompanyLoginError : 'Default'
    } catch {
        // NextAuth does not catch a sign-in request that fails on the network.
        return 'Default'
    }
}
