import type { committeesParticipatingIncluder } from './constants'
import type { Prisma } from '@/prisma-generated-pn-types'
import type { ExpandedImage } from '@/services/images/subservice/types'

type RawExpandedApplicationPeriod = Prisma.ApplicationPeriodGetPayload<{
    include: typeof committeesParticipatingIncluder
}>

type Participation = RawExpandedApplicationPeriod['committeesParticipating'][number]

// committee.logoImage is resolved to a non-null default by applicationPeriodOperations.read.
export type ExpandedApplicationPeriod = Omit<RawExpandedApplicationPeriod, 'committeesParticipating'> & {
    committeesParticipating: (Participation & { committee: { logoImage: ExpandedImage } })[]
}
