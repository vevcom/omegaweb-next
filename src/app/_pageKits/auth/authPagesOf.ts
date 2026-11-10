import { omegaAuthPages } from '@/app/(omegaweb)/(auth)/config'
import { careersAuthPages } from '@/app/(careers)/career/(auth)/config'
import { revueAuthPages } from '@/app/(revue)/revue/(auth)/config'
import type { AuthPagesConfig } from './config'
import type { Site, SiteName } from '@/lib/sites/site'

const authPages: Record<SiteName, AuthPagesConfig> = {
    OMEGAWEB: omegaAuthPages,
    CAREERS: careersAuthPages,
    REVUE: revueAuthPages,
}

/** The sign in flow of a site, for code that knows only the site: serverPage's redirects and the emails. */
export function authPagesOf(site: Site): AuthPagesConfig {
    return authPages[site.name]
}
