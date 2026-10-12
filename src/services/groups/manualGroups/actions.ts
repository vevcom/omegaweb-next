'use server'

import { makeAction } from '@/services/serverAction'
import { manualGroupOperations } from '@/services/groups/manualGroups/operations'

export const createManualGroupAction = makeAction(manualGroupOperations.create)
export const updateManualGroupAction = makeAction(manualGroupOperations.update)
export const destroyManualGroupAction = makeAction(manualGroupOperations.destroy)
export const addManualGroupMembersAction = makeAction(manualGroupOperations.addMembers)
export const removeManualGroupMembersAction = makeAction(manualGroupOperations.removeMembers)
export const setManualGroupMemberAdminAction = makeAction(manualGroupOperations.setMemberAdmin)
export const setManualGroupMemberTitleAction = makeAction(manualGroupOperations.setMemberTitle)
export const migrateManualGroupAction = makeAction(manualGroupOperations.migrateGroup)
export const pensionManualGroupAction = makeAction(manualGroupOperations.pension)
