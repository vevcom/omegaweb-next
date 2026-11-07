import type { AuthPagesConfig } from '@/pageKits/auth/config'

/** The sign in and sign up flow of Omega's site: the account's own, landing on the profile. */
export const omegaAuthPages: AuthPagesConfig = {
    site: 'OMEGAWEB',
    mountPath: '',
    siteName: 'Veven',
    afterLoginPath: '/users/me',
    afterLogoutPath: '',
    accountNotice: null,
    asksSex: true,
}
