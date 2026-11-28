import { chatUserContract } from '@/services/chat/users/contract'
import { defineCapabilities } from '@/services/serviceContract'

export const chatUserCapabilities = defineCapabilities(chatUserContract, {})
