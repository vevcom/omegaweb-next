import { omegaAuthPages } from '@/app/(omegaweb)/(auth)/config'
import type { EventPagesConfig } from '@/pageKits/events/config'

/** The event pages of Omega's site: every event, filtered by the tags the visitor picks. */
export const omegaEventPages: EventPagesConfig = {
    site: 'OMEGAWEB',
    mountPath: '/events',
    titles: { current: 'Hvad der hender', archive: 'Hvad der har hendt' },
    lockedTag: null,
    authPages: omegaAuthPages,
}
