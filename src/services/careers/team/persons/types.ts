import type { CareerTeamPerson } from '@/prisma-generated-pn-types'
import type { ExpandedImage } from '@/services/images/subservice/types'

export type ExpandedCareerTeamPerson = CareerTeamPerson & {
    image: ExpandedImage | null
}
