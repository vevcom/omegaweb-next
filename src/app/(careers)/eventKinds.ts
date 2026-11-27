import { careerPages } from './config'
import { eventHomePages } from '@/pageKits/events/homePages'
import { EventKind } from '@/prisma-generated-pn-types'

/** The kinds of event whose home pages are on the career site. */
export const careerEventKinds = Object.values(EventKind).filter(kind => eventHomePages[kind].site === careerPages.site)
