import { careersAuthPages } from '@/app/(careers)/career/(auth)/config'
import type { EventPagesConfig } from '@/pageKits/events/config'

/** The speed interviews as the career site's event pages: the events of that kind, in the career site's chrome. */
export const speedInterviewPages: EventPagesConfig = {
    site: 'CAREERS',
    mountPath: '/speed-interviews',
    titles: { current: 'Speedintervjuer', archive: 'Tidligere speedintervjuer' },
    kindsToShow: ['SPEED_INTERVIEW'],
    defaultKind: 'SPEED_INTERVIEW',
    tagFilter: false,
    authPages: careersAuthPages,
}
