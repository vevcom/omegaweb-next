import '@pn-server-only'
import { companyAuth } from './auth'
import {
    companySponsorOrdering,
    logoIncluder,
    sponsorSelection,
} from './constants'
import { companyParamsSchemas, companySchemas } from './schemas'
import { defineOperation } from '@/services/serviceOperation'
import { takeAdvisoryLock } from '@/lib/advisoryLocks'
import { cursorPagingSelection } from '@/lib/paging/cursorPagingSelection'
import { cmsImageOperations } from '@/cms/images/operations'
import { CompanySponsorTier } from '@/prisma-generated-pn-types'
import type { SponsorCompany } from './types'

export const companyOperations = {
    create: defineOperation({
        dataSchema: companySchemas.create,
        authorizer: () => companyAuth.create,
        opensTransaction: true,
        operation: async ({ prisma, data }) => prisma.$transaction(async (tx) => {
            const logo = await cmsImageOperations.create.internalCall({
                data: {},
                prisma: tx,
                operationImplementationFields: { special: null },
            })
            return tx.company.create({
                data: {
                    ...data,
                    logo: { connect: { id: logo.id } },
                },
            })
        }),
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
        paramsSchema: companyParamsSchemas.readPage,
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
        paramsSchema: companyParamsSchemas.update,
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
        paramsSchema: companyParamsSchemas.updateSponsorTier,
        dataSchema: companySchemas.updateSponsorTier,
        authorizer: () => companyAuth.updateSponsorTier,
        opensTransaction: true,
        operation: async ({ prisma, params: { id }, data: { sponsorTier } }) =>
            await prisma.$transaction(async tx => {
                await takeAdvisoryLock(tx, 'companySponsorTier')

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
        implementationParamsSchema: companyParamsSchemas.updateCmsImageLogo,
        authorizer: () => companyAuth.updateCmsImageLogo,
        ownershipCheck: async ({ implementationParams, params, prisma }) =>
            (await prisma.company.findUniqueOrThrow({
                where: { id: implementationParams.companyId },
                select: { logoId: true }
            }))?.logoId === params.cmsImageId
    }),
    destroy: defineOperation({
        paramsSchema: companyParamsSchemas.destroy,
        authorizer: () => companyAuth.destroy,
        opensTransaction: true,
        operation: async ({ prisma, params: { id } }) => prisma.$transaction(async (tx) => {
            // The logo is on the company's side of the relation, so it does not cascade.
            const company = await tx.company.delete({
                where: { id },
                select: { logoId: true },
            })
            await cmsImageOperations.destroy.internalCall({ params: { cmsImageId: company.logoId }, prisma: tx })
        }),
    }),
} as const
