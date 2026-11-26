'use server'
import { chatSessionOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const readChatSessionAction = makeAction(chatSessionOperations.read)
