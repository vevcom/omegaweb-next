import type { AuthPagesConfig } from '@/pageKits/auth/config'

/** The sign in and sign up flow on the revue site: the same account as on Omega's site, landing on the frontpage. */
export const revueAuthPages: AuthPagesConfig = {
    site: 'REVUE',
    path: '',
    siteName: 'Omegarevyen',
    afterLoginPath: '',
    afterLogoutPath: '',
    accountNotice: 'Omegarevyen er revyen til linjeforeningen Omega ved NTNU, og brukeren du lager her er en bruker '
        + 'på Omegas nettsider. Den samme brukeren gjelder både på Omegarevyen og på Omegaveven.',
}
