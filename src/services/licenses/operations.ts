import '@pn-server-only'
import { licenseSchemas } from './schemas'
import { standardLicenseNames, standardLicensesConfig, type StandardLicenseName } from './constants'
import { licenseAuth } from './auth'
import { ServiceError } from '@/services/error'
import { defineOperation, defineSubOperation } from '@/services/serviceOperation'
import { z } from 'zod'

const getStandardLicenseConfig = (standardLicenseName: StandardLicenseName) => {
    const licenseConfig = standardLicensesConfig.find((license) => license.name === standardLicenseName)
    if (!licenseConfig) {
        throw new ServiceError('SERVER ERROR', `Unknown standard license: ${standardLicenseName}`)
    }

    return licenseConfig
}

const generateStandardLicense = defineSubOperation({
    paramsSchema: () => z.object({
        standardLicenseName: z.enum(standardLicenseNames),
    }),
    operation: () => async ({ prisma, params }) => {
        const licenseConfig = getStandardLicenseConfig(params.standardLicenseName)

        return await prisma.license.upsert({
            where: { name: params.standardLicenseName },
            create: {
                name: licenseConfig.name,
                link: licenseConfig.link,
            },
            update: {
                link: licenseConfig.link,
            },
        })
    }
})

const readStandardLicense = defineSubOperation({
    paramsSchema: () => z.object({
        standardLicenseName: z.enum(standardLicenseNames),
    }),
    operation: () => async ({ prisma, params }) => {
        const license = await prisma.license.findUnique({
            where: { name: params.standardLicenseName },
        })

        if (license) return license

        try {
            return await generateStandardLicense.internalCall({
                prisma,
                params: { standardLicenseName: params.standardLicenseName }
            })
        } catch (error) {
            // Handle race condition.
            // Just in case two concurrent callers tried at the same time
            if (error instanceof ServiceError && error.errorCode === 'DUPLICATE') {
                return await prisma.license.findUniqueOrThrow({
                    where: { name: params.standardLicenseName },
                })
            }
            throw error
        }
    },
})

export const licenseOperations = {
    create: defineOperation({
        authorizer: () => licenseAuth.create,
        dataSchema: licenseSchemas.create,
        operation: async ({ prisma, data }) => await prisma.license.create({
            data,
        }),
    }),
    readAll: defineOperation({
        authorizer: () => licenseAuth.destroy,
        operation: async ({ prisma }) => await prisma.license.findMany()
    }),
    destroy: defineOperation({
        paramsSchema: z.object({
            id: z.number(),
        }),
        authorizer: () => licenseAuth.destroy,
        operation: async ({ prisma, params }) => {
            const { name: licenseName } = await prisma.license.findUniqueOrThrow({
                where: { id: params.id },
                select: { name: true }
            })

            const imagesOfLicense = await prisma.image.findMany({
                where: {
                    licenseName
                },
                take: 1
            })
            if (imagesOfLicense.length > 0) {
                throw new ServiceError(
                    'UNPERMITTED CASCADE',
                    'Lisensen har bilder tilknyttet - slett bildene først eller endre lisensen på bildene'
                )
            }

            await prisma.license.delete({ where: { id: params.id } })
        }
    }),
    update: defineOperation({
        paramsSchema: z.object({
            id: z.number(),
        }),
        dataSchema: licenseSchemas.update,
        authorizer: () => licenseAuth.update,
        operation: async ({ prisma, params, data }) => {
            await prisma.license.update({
                where: {
                    id: params.id
                },
                data
            })
        }
    }),
    generateStandardLicense,
    readStandardLicense,
} as const
