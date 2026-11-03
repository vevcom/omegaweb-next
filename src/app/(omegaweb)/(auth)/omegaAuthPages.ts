import type { AuthPagesConfig } from '@/components/Auth/Pages/authPages'

/** The sign in and sign up flow of Omega's site: the account's own, landing on the profile. */
export const omegaAuthPages: AuthPagesConfig = {
    site: 'OMEGAWEB',
    siteName: 'Veven',
    afterLoginPath: '/users/me',
    afterLogoutPath: '/',
    accountNotice: null,
}
