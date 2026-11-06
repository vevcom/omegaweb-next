import type { ExpandedCareerTeamPerson } from './persons/types'
import type { CareerTeamDepartment, CmsParagraph } from '@/prisma-generated-pn-types'

export type ExpandedCareerTeamDepartment = CareerTeamDepartment & {
    paragraph: CmsParagraph
    persons: ExpandedCareerTeamPerson[]
}
