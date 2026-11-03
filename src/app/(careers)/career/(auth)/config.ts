import type { AuthPagesConfig } from '@/pageKits/auth/config'

/** The sign in and sign up flow on the career site: the same account as on Omega's site, landing on the frontpage. */
export const careersAuthPages: AuthPagesConfig = {
    site: 'CAREERS',
    path: '',
    siteName: 'Contactor',
    afterLoginPath: '',
    afterLogoutPath: '',
    accountNotice: 'Contactor er karrieresiden til linjeforeningen Omega ved NTNU, og brukeren du lager her er en '
        + 'bruker på Omegas nettsider. Den samme brukeren gjelder både på Contactor og på Omegaveven.',
}
