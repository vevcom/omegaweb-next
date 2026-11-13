import type { chatSpaceOperations } from './subservice/operations'
import type { ActionFromSubServiceOperation } from '@/services/actionTypes'

type ChatSpaceOperations = typeof chatSpaceOperations
type ChatSpaceAction<Name extends keyof ChatSpaceOperations> = ActionFromSubServiceOperation<ChatSpaceOperations[Name]>
type ReadBy<Name extends 'readMembers' | 'readRooms'> =
    Awaited<ReturnType<ChatSpaceOperations[Name]['internalCall']>>[number]

/** One owner's actions on its spaces, with its implementation params bound. An action left out is not offered. */
export type ChatSpaceAdminActions = Partial<{
    update: ChatSpaceAction<'update'>,
    createRoom: ChatSpaceAction<'createRoom'>,
    updateRoom: ChatSpaceAction<'updateRoom'>,
    destroyRoom: ChatSpaceAction<'destroyRoom'>,
    addMembers: ChatSpaceAction<'addMembers'>,
    removeMembers: ChatSpaceAction<'removeMembers'>,
}>

export type ChatSpaceMemberOverview = ReadBy<'readMembers'>
export type ChatSpaceRoomOverview = ReadBy<'readRooms'>
