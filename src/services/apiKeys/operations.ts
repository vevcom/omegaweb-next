import '@ow-server-only'
import { apiKeyAuth } from './auth'
import { apiKeySchemas } from './schemas'
import { apiKeyHashAndEncrypt } from './hashEncryptKey'
import { encodeApiKey } from './apiKeyEncoder'
import { apiFilterSelection, apiKeyLength } from './constants'
import { ServiceError } from '@/services/error'
import { defineOperation } from '@/services/serviceOperation'
import logger from '@/lib/logger'
import crypto from 'crypto'
import type { ApiKeyFiltered, ApiKeyFilteredWithKey } from './types'
import type { z } from 'zod'

/**
 * Updates the active status of an api key if it has expired, i.e. if the expiresAt date is in the past.
 * This method is used when reading api keys to ensure that the active status is correct.
 *
 * Note: This operaiton is only used internally.
 */
const updateIfExpired = defineOperation({
    authorizer: () => apiKeyAuth.updateIfExpired,
    paramsSchema: apiKeySchemas.params.updateIfExpired,
    read: false,
    operation: async ({ prisma, params: apiKey }) => {
        if (!apiKey.expiresAt || apiKey.expiresAt > new Date()) return { active: apiKey.active }
        logger.info('Deactivating expired api key', { id: apiKey.id })

        const updated = await prisma.apiKey.update({
            where: { id: apiKey.id },
            data: { active: false },
            select: { active: true },
        })
        return {
            active: updated.active,
        }
    }
})

export const apiKeyOperations = {
    create: defineOperation({
        authorizer: () => apiKeyAuth.create,
        dataSchema: apiKeySchemas.data.create,
        read: false,
        operation: async ({ prisma, data }): Promise<ApiKeyFilteredWithKey> => {
            const NODE_ENV = process.env.NODE_ENV
            const prepend = NODE_ENV === 'production' ? 'prod' : 'dev'

            const key = prepend + crypto.randomBytes(apiKeyLength - prepend.length).toString('hex')
            const keyHashEncrypted = await apiKeyHashAndEncrypt(key)

            const apiKey = await prisma.apiKey.create({
                data: {
                    keyHashEncrypted,
                    name: data.name,
                    active: true,
                },
                select: apiFilterSelection,
            })
            return { ...apiKey, key: encodeApiKey({ key, id: apiKey.id }) }
        }
    }),
    read: defineOperation({
        authorizer: () => apiKeyAuth.read,
        paramsSchema: apiKeySchemas.params.read,
        read: true,
        operation: async ({ prisma, params }): Promise<ApiKeyFiltered> => {
            const apiKey = await prisma.apiKey.findUnique({
                where: {
                    id: 'id' in params ? params.id : undefined,
                    name: 'name' in params ? params.name : undefined,
                },
                select: apiFilterSelection,
            })

            if (!apiKey) throw new ServiceError('BAD PARAMETERS', 'API-nøkkelen finnes ikke')
            return {
                ...apiKey,
                ...await activeUnlessExpired(apiKey)
            }
        }
    }),
    readMany: defineOperation({
        authorizer: () => apiKeyAuth.readMany,
        read: true,
        operation: async ({ prisma }): Promise<ApiKeyFiltered[]> => {
            const apiKeys = await prisma.apiKey.findMany({
                select: apiFilterSelection,
                orderBy: [
                    { active: 'desc' },
                    { name: 'asc' }
                ]
            })

            return await Promise.all(apiKeys.map(async apiKey => ({
                ...apiKey,
                ...await activeUnlessExpired(apiKey)
            })))
        }
    }),
    readWithHash: defineOperation({
        authorizer: () => apiKeyAuth.readWithHash,
        paramsSchema: apiKeySchemas.params.readWithHash,
        read: true,
        operation: async ({ prisma, params }) => {
            const apiKey = await prisma.apiKey.findUniqueOrThrow({
                where: { id: params.id },
                select: {
                    keyHashEncrypted: true,
                    active: true,
                    expiresAt: true,
                    id: true,
                    permissions: true
                }
            })

            return {
                ...apiKey,
                ...await activeUnlessExpired(apiKey),
            }
        }
    }),
    update: defineOperation({
        authorizer: () => apiKeyAuth.update,
        paramsSchema: apiKeySchemas.params.update,
        dataSchema: apiKeySchemas.data.update,
        read: false,
        operation: async ({ prisma, params, data }) => {
            if (data.active && data.expiresAt && data.expiresAt < new Date()) {
                throw new ServiceError('BAD PARAMETERS', 'Hvis du vil aktivere en nøkkel, kan den ikke ha utløpt')
            }

            const { name } = await prisma.apiKey.update({
                where: { id: params.id },
                data,
            })
            return { name }
        },
    }),
    destroy: defineOperation({
        authorizer: () => apiKeyAuth.destroy,
        paramsSchema: apiKeySchemas.params.destroy,
        transaction: 'RUNS_IN',
        read: false,
        operation: async ({ prisma, params }): Promise<void> => {
            const apiKey = await prisma.apiKey.findUniqueOrThrow({
                where: { id: params.id },
                select: { active: true }
            })

            if (apiKey.active) {
                throw new ServiceError('BAD PARAMETERS', 'Du kan ikke slette en aktiv nøkkel - deaktiver den først')
            }

            await prisma.apiKey.delete({
                where: { id: params.id }
            })
        }
    }),
} as const

/** Whether the key is active. Only an active key that has expired is updated, so a read of any other writes nothing. */
async function activeUnlessExpired(apiKey: z.infer<typeof apiKeySchemas.params.updateIfExpired>) {
    if (!apiKey.active || !apiKey.expiresAt || apiKey.expiresAt > new Date()) return { active: apiKey.active }
    return updateIfExpired({ params: apiKey, bypassAuth: true })
}
