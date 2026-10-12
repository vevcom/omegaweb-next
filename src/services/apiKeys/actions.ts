'use server'

import { makeAction } from '@/services/serverAction'
import { apiKeyOperations } from '@/services/apiKeys/operations'

export const createApiKeyAction = makeAction(apiKeyOperations.create)

export const destroyApiKeyAction = makeAction(apiKeyOperations.destroy)

export const updateApiKeyAction = makeAction(apiKeyOperations.update)
