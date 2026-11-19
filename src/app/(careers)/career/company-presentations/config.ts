import { careersAuthPages } from '@/app/(careers)/career/(auth)/config'
import type { EventPagesConfig } from '@/pageKits/events/config'

/** The company presentations as the career site's event pages: the events of that kind, in the career site's chrome. */
export const companyPresentationPages: EventPagesConfig = {
    site: 'CAREERS',
    mountPath: '/company-presentations',
    titles: { current: 'Bedriftspresentasjoner', archive: 'Tidligere bedriftspresentasjoner' },
    kindsToShow: ['COMPANY_PRESENTATION'],
    defaultKind: 'COMPANY_PRESENTATION',
    tagFilter: false,
    authPages: careersAuthPages,
}
