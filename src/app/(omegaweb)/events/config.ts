import { omegaAuthPages } from '@/app/(omegaweb)/(auth)/config'
import { EventKind } from '@/prisma-generated-pn-types'
import type { EventPagesConfig } from '@/pageKits/events/config'

/** The event pages of Omega's site: the events of every kind, filtered by the tags the visitor picks. */
export const omegaEventPages: EventPagesConfig = {
    site: 'OMEGAWEB',
    mountPath: '/events',
    titles: { current: 'Hvad der hender', archive: 'Hvad der har hendt' },
    kindsToShow: Object.values(EventKind),
    defaultKind: 'ORDINARY',
    tagFilter: true,
    authPages: omegaAuthPages,
}
