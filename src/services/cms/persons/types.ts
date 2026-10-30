import type { cmsPersonOperations } from './operations'
import type { ActionFromSubServiceOperation } from '@/services/actionTypes'
import type { CmsPerson } from '@/prisma-generated-pn-types'
import type { ExpandedImage } from '@/services/images/subservice/types'

export type ExpandedCmsPerson = CmsPerson & {
    image: ExpandedImage | null
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
export type UpdateCmsPersonImageAction = ActionFromSubServiceOperation<typeof cmsPersonOperations.updateImage>
