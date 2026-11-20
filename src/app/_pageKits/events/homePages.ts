import { omegaEventPages } from '@/app/(omegaweb)/events/config'
import { companyPresentationPages } from '@/app/(careers)/career/company-presentations/config'
import { speedInterviewPages } from '@/app/(careers)/career/speed-interviews/config'
import type { EventPagesConfig } from './config'
import type { EventKind } from '@/prisma-generated-pn-types'

/**
 * The pages an event of a kind belongs on. Pages that do not show the kind link to an event of it
 * there; see `eventLinks`. Each must show the kind it is the home of.
 */
export const eventHomePages = {
    ORDINARY: omegaEventPages,
    COMPANY_PRESENTATION: companyPresentationPages,
    SPEED_INTERVIEW: speedInterviewPages,
} as const satisfies Record<EventKind, EventPagesConfig>
