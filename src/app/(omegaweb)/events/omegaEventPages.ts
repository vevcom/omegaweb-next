import type { EventPagesConfig } from '@/components/Event/Pages/eventPages'

/** The event pages of Omega's site: every event, filtered by the tags the visitor picks. */
export const omegaEventPages: EventPagesConfig = {
    basePath: '/events',
    titles: { current: 'Hvad der hender', archive: 'Hvad der har hendt' },
    lockedTag: null,
}
