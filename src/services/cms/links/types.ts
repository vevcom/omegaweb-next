import type { cmsLinkOperations } from './operations'
import type { ActionFromSubServiceOperation } from '@/services/actionTypes'
import type { implementSpecialCmsLinks } from './implement'

export type UpdateCmsLinkAction = ActionFromSubServiceOperation<typeof cmsLinkOperations.update>
/** The read operation of a service that owns special links, as the SpecialCmsLink component takes it. */
export type ReadSpecialCmsLink = ReturnType<typeof implementSpecialCmsLinks>['read']
