import { omegaAuthPages } from '@/app/(omegaweb)/(auth)/omegaAuthPages'
import { careersAuthPages } from '@/app/(careers)/_lib/careersSite'
import { revueAuthPages } from '@/app/(revue)/_lib/revueSite'
import type { Site } from '@/lib/sites'
import type { AuthPagesConfig } from '@/pageKits/auth/config'

/** The sign in flow of each site, for code that knows only the site: serverPage's redirects and the emails. */
export const authPagesOfSite: Record<Site, AuthPagesConfig> = {
    OMEGAWEB: omegaAuthPages,
    CAREERS: careersAuthPages,
    REVUE: revueAuthPages,
}
