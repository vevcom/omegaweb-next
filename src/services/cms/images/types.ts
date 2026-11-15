import type { ActionFromSubServiceOperation } from '@/services/actionTypes'
import type { implementSpecialCmsImages } from './implement'
import type { cmsImageOperations } from './operations'
import type { ExpandedImage } from '@/services/images/subservice/types'
import type { CmsImage } from '@/prisma-generated-pn-types'

export type ExpandedCmsImage = CmsImage & {
    image: ExpandedImage | null
}

export type UpdateCmsImageAction = ActionFromSubServiceOperation<typeof cmsImageOperations.update>
/** The read operation of a service that owns special cms images, as the SpecialCmsImage component takes it. */
export type ReadSpecialCmsImage = ReturnType<typeof implementSpecialCmsImages>['read']
