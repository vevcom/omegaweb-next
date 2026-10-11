import type { committeesParticipatingIncluder } from './constants'
import type { Prisma } from '@/prisma-generated-pn-types'
import type { ExpandedImage } from '@/services/images/subservice/types'

type RawExpandedApplicationPeriod = Prisma.ApplicationPeriodGetPayload<{
    include: typeof committeesParticipatingIncluder
}>

// committee.logoImage is resolved to a non-null default by applicationPeriodOperations.read,
// unlike the raw (nullable) shape committeesParticipatingIncluder would otherwise imply.
export type ExpandedApplicationPeriod = Omit<RawExpandedApplicationPeriod, 'committeesParticipating'> & {
    committeesParticipating: (
        Omit<RawExpandedApplicationPeriod['committeesParticipating'][number], 'committee'> & {
            committee: Omit<RawExpandedApplicationPeriod['committeesParticipating'][number]['committee'], 'logoImage'> & {
                logoImage: ExpandedImage
            }
        }
    )[]
}
