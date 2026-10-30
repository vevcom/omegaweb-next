import type { cmsPersonOperations } from './operations'
import type { ExpandedCmsImage } from '@/cms/images/types'
import type { ActionFromSubServiceOperation } from '@/services/actionTypes'
import type { CmsPerson } from '@/prisma-generated-pn-types'

export type ExpandedCmsPerson = CmsPerson & {
    cmsImage: ExpandedCmsImage
}

/**
 * The row a person belongs to. A person is ordered among the persons of the same owner, so a new
 * owning service adds its foreign key here.
 */
export type CmsPersonOwner = {
    careerTeamDepartmentId: number
}

export type UpdateCmsPersonAction = ActionFromSubServiceOperation<typeof cmsPersonOperations.update>
export type DestroyCmsPersonAction = ActionFromSubServiceOperation<typeof cmsPersonOperations.destroy>
export type MoveCmsPersonAction = ActionFromSubServiceOperation<typeof cmsPersonOperations.move>
