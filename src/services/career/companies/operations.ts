import '@pn-server-only'
import { companyAuth } from './auth'
import {
    companySponsorOrdering,
    companySponsorTierLockKey,
    logoIncluder,
    sponsorSelection,
} from './constants'
import { companySchemas } from './schemas'
import { defineOperation } from '@/services/serviceOperation'
import { cursorPagingSelection } from '@/lib/paging/cursorPagingSelection'
import { cmsImageOperations } from '@/cms/images/operations'
import { CompanySponsorTier } from '@/prisma-generated-pn-types'
import { z } from 'zod'
import type { SponsorCompany } from './types'

export const companyOperations = {
    create: defineOperation({
        dataSchema: companySchemas.create,
        authorizer: () => companyAuth.create,
        operation: async ({ prisma, data }) => {
            //TODO: tranaction when createCmsImage is service operation.
            const logo = await cmsImageOperations.create.internalCall({
                data: {},
                operationImplementationFields: { special: null }
            })
            return await prisma.company.create({
                data: {
                    ...data,
                    logoId: logo.id,
                }
            })
        }
    }),
    readSponsors: defineOperation({
        authorizer: () => companyAuth.readSponsors,
        operation: async ({ prisma }): Promise<SponsorCompany[]> => await prisma.company.findMany({
            where: {
                sponsorTier: { not: CompanySponsorTier.NONE },
            },
            orderBy: companySponsorOrdering,
            select: sponsorSelection,
        })
    }),
    readPage: defineOperation({
        paramsSchema: companySchemas.readPage,
        authorizer: () => companyAuth.readPage,
        operation: async ({ prisma, params }) => await prisma.company.findMany({
            ...cursorPagingSelection(params.paging.page),
            where: {
                name: {
                    contains: params.paging.details.name,
                    mode: 'insensitive'
                }
            },
            orderBy: companySponsorOrdering,
            include: logoIncluder,
        })
    }),
    update: defineOperation({
        paramsSchema: z.object({
            id: z.number(),
        }),
        dataSchema: companySchemas.update,
        authorizer: () => companyAuth.update,
        operation: async ({ prisma, params: { id }, data }) => {
            await prisma.company.update({
                where: { id },
                data,
            })
        },
    }),
    updateSponsorTier: defineOperation({
        paramsSchema: z.object({
            id: z.number(),
        }),
        dataSchema: companySchemas.updateSponsorTier,
        authorizer: () => companyAuth.updateSponsorTier,
        opensTransaction: true,
        operation: async ({ prisma, params: { id }, data: { sponsorTier } }) =>
            await prisma.$transaction(async tx => {
                await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(${companySponsorTierLockKey}::bigint)`

                if (sponsorTier === CompanySponsorTier.MAIN) {
                    await tx.company.updateMany({
                        where: {
                            sponsorTier: CompanySponsorTier.MAIN,
                            id: { not: id },
                        },
                        data: { sponsorTier: CompanySponsorTier.SPONSOR },
                    })
                }
                await tx.company.update({
                    where: { id },
                    data: { sponsorTier },
                })
            })
    }),
    updateCmsImageLogo: cmsImageOperations.update.implement({
        implementationParamsSchema: z.object({
            companyId: z.number(),
        }),
        authorizer: () => companyAuth.updateCmsImageLogo,
        ownershipCheck: async ({ implementationParams, params, prisma }) =>
            (await prisma.company.findUniqueOrThrow({
                where: { id: implementationParams.companyId },
                select: { logoId: true }
            }))?.logoId === params.cmsImageId
    }),
    destroy: defineOperation({
        paramsSchema: z.object({
            id: z.number()
        }),
        authorizer: () => companyAuth.destroy,
        operation: async ({ prisma, params: { id } }) => {
            await prisma.company.delete({
                where: {
                    id
                }
            })
        }
    }),
} as const
