'use server'
import { revueSubGroupOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const readRevueSubGroupAddableUsersAction = makeAction(revueSubGroupOperations.readAddableUsers)
export const addRevueSubGroupMembersAction = makeAction(revueSubGroupOperations.addMembers)
export const removeRevueSubGroupMembersAction = makeAction(revueSubGroupOperations.removeMembers)
export const setRevueSubGroupMemberAdminAction = makeAction(revueSubGroupOperations.setMemberAdmin)
export const setRevueSubGroupMemberTitleAction = makeAction(revueSubGroupOperations.setMemberTitle)
export const reorderRevueSubGroupMembersAction = makeAction(revueSubGroupOperations.reorderMembers)
