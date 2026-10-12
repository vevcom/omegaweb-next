import '@pn-server-only'
import { cabinSettingsAuth } from './auth'
import { cabinSettingsSchemas } from './schemas'
import { defineOperation } from '@/services/serviceOperation'

// Singleton settings row for the cabin booking domain (see the CabinSettings model comment).
export const cabinSettingsOperations = {
    read: defineOperation({
        authorizer: () => cabinSettingsAuth.read,
        operation: async ({ prisma }) => await prisma.cabinSettings.findFirst(),
    }),

    update: defineOperation({
        authorizer: () => cabinSettingsAuth.update,
        dataSchema: cabinSettingsSchemas.update,
        operation: async ({ prisma, data }) => {
            const existing = await prisma.cabinSettings.findFirst()

            if (existing) {
                return await prisma.cabinSettings.update({
                    where: { id: existing.id },
                    data,
                })
            }

            return await prisma.cabinSettings.create({ data })
        },
    }),
} as const
