import { omegaAuthPages } from '@/app/(omegaweb)/(auth)/config'
import { careersAuthPages } from '@/app/(careers)/career/(auth)/config'
import { revueAuthPages } from '@/app/(revue)/revue/(auth)/config'
import type { Site } from './sites'
import type { AuthPagesConfig } from '@/pageKits/auth/config'

/** The sign in flow of each site, for code that knows only the site: serverPage's redirects and the emails. */
export const authPagesOfSite: Record<Site, AuthPagesConfig> = {
    OMEGAWEB: omegaAuthPages,
    CAREERS: careersAuthPages,
    REVUE: revueAuthPages,
}
