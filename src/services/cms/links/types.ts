import type { cmsLinkOperations } from './operations'
import type { ActionFromSubServiceOperation } from '@/services/actionTypes'

export type UpdateCmsLinkAction = ActionFromSubServiceOperation<typeof cmsLinkOperations.update>
export type ReadSpecialCmsLinkAction = ActionFromSubServiceOperation<typeof cmsLinkOperations.readSpecial>
