import type { cmsParagraphOperations } from './operations'
import type { ActionFromSubServiceOperation } from '@/services/actionTypes'
import type { implementSpecialCmsParagraphs } from './implement'

export type UpdateCmsParagraphAction = ActionFromSubServiceOperation<typeof cmsParagraphOperations.updateContent>
/** The read operation of a service that owns special paragraphs, as the SpecialCmsParagraph component takes it. */
export type ReadSpecialCmsParagraph = ReturnType<typeof implementSpecialCmsParagraphs>['read']
