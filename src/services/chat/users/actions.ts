'use server'
import { makeAction } from '@/services/serverAction'
import { chatUserOperations } from '@/services/chat/users/operations'

export const updateChatPictureAction = makeAction(chatUserOperations.updatePicture)
export const destroyChatPictureAction = makeAction(chatUserOperations.destroyPicture)
export const readChatProfilesAction = makeAction(chatUserOperations.readProfiles)
export const readChatUserPageAction = makeAction(chatUserOperations.readPage)
