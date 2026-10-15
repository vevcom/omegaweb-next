import type { ExpandedScreenPage } from './pages/types'
import type { Screen } from '@/prisma-generated-pn-types'

/** A screen with the pages it shows, in the order it shows them. */
export type ExpandedScreen = Screen & {
    pages: ExpandedScreenPage[],
}
