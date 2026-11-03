import { defineLinks } from '@/lib/sites/defineLinks'
import type { SitePages } from '@/lib/sites/sites'
import type { AuthPagesConfig } from '@/pageKits/auth/config'

/** The revue site itself, which its own pages are relative to. */
export const revuePages: SitePages = { site: 'REVUE', path: '' }

export type RevueLinks = {
    frontpage: () => string,
}

export const revueLinks: RevueLinks = defineLinks<SitePages, RevueLinks>(href => ({
    frontpage: () => href(),
}))(revuePages)

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
