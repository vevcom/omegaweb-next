'use server'
import { makeAction } from '@/services/serverAction'
import { manualChatSpaceOperations } from '@/services/manualChat/operations'

export const createManualChatSpaceAction = makeAction(manualChatSpaceOperations.create)
export const updateManualChatSpaceAction = makeAction(manualChatSpaceOperations.update)
export const destroyManualChatSpaceAction = makeAction(manualChatSpaceOperations.destroy)
export const addManualChatSpaceAdminsAction = makeAction(manualChatSpaceOperations.addAdmins)
export const removeManualChatSpaceAdminsAction = makeAction(manualChatSpaceOperations.removeAdmins)
export const addManualChatSpaceMembersAction = makeAction(manualChatSpaceOperations.addMembers)
export const removeManualChatSpaceMembersAction = makeAction(manualChatSpaceOperations.removeMembers)
export const createManualChatSpaceRoomAction = makeAction(manualChatSpaceOperations.createRoom)
export const updateManualChatSpaceRoomAction = makeAction(manualChatSpaceOperations.updateRoom)
export const destroyManualChatSpaceRoomAction = makeAction(manualChatSpaceOperations.destroyRoom)
export const addManualChatSpaceRoomMembersAction = makeAction(manualChatSpaceOperations.addRoomMembers)
export const removeManualChatSpaceRoomMembersAction = makeAction(manualChatSpaceOperations.removeRoomMembers)
