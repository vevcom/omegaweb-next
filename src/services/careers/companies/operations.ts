import '@pn-server-only'
import { companyAuth } from './auth'
import {
    companySponsorOrdering,
    logoIncluder,
    sponsorSelection,
} from './constants'
import { companySchemas } from './schemas'
import { defineOperation } from '@/services/serviceOperation'
import { takeAdvisoryLock } from '@/lib/advisoryLocks'
import { cursorPagingSelection } from '@/lib/paging/cursorPagingSelection'
import { cmsImageOperations } from '@/cms/images/operations'
import { implementSearchOperation } from '@/services/search/implement'
import { careerLinks } from '@/app/(careers)/links'
import { CompanySponsorTier } from '@/prisma-generated-pn-types'
import type { SponsorCompany } from './types'

export const companyOperations = {
    create: defineOperation({
        dataSchema: companySchemas.data.create,
        authorizer: () => companyAuth.create,
        transaction: 'RUNS_IN',
        operation: async ({ prisma, data }) => {
            const logo = await cmsImageOperations.create.internalCall({
                data: {},
                prisma,
                operationImplementationFields: { special: null },
            })
            return prisma.company.create({
                data: {
                    ...data,
                    logo: { connect: { id: logo.id } },
                },
            })
        },
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
        paramsSchema: companySchemas.params.readPage,
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
    search: implementSearchOperation({
        authorizer: () => companyAuth.search,
        find: ({ prisma, query, take }) => prisma.company.findMany({
            take,
            where: { name: { contains: query, mode: 'insensitive' } },
            orderBy: companySponsorOrdering,
            include: logoIncluder,
        }),
        // A company has no page of its own, so the result opens the company list filtered to it.
        toSearchResult: company => ({
            key: `company-${company.id}`,
            href: careerLinks.companies(company.name),
            label: company.name,
            image: company.logo.image,
        }),
    }),
    update: defineOperation({
        paramsSchema: companySchemas.params.update,
        dataSchema: companySchemas.data.update,
        authorizer: () => companyAuth.update,
        operation: async ({ prisma, params: { id }, data }) => {
            await prisma.company.update({
                where: { id },
                data,
            })
        },
    }),
    updateSponsorTier: defineOperation({
        paramsSchema: companySchemas.params.updateSponsorTier,
        dataSchema: companySchemas.data.updateSponsorTier,
        authorizer: () => companyAuth.updateSponsorTier,
        transaction: 'RUNS_IN',
        operation: async ({ prisma, params: { id }, data: { sponsorTier } }) => {
            await takeAdvisoryLock(prisma, 'companySponsorTier')

            if (sponsorTier === CompanySponsorTier.MAIN) {
                await prisma.company.updateMany({
                    where: {
                        sponsorTier: CompanySponsorTier.MAIN,
                        id: { not: id },
                    },
                    data: { sponsorTier: CompanySponsorTier.SPONSOR },
                })
            }
            await prisma.company.update({
                where: { id },
                data: { sponsorTier },
            })
        },
    }),
    updateCmsImageLogo: cmsImageOperations.update.implement({
        implementationParamsSchema: companySchemas.params.updateCmsImageLogo,
        authorizer: () => companyAuth.updateCmsImageLogo,
        ownershipCheck: async ({ implementationParams, params, prisma }) =>
            (await prisma.company.findUniqueOrThrow({
                where: { id: implementationParams.companyId },
                select: { logoId: true }
            }))?.logoId === params.cmsImageId
    }),
    destroy: defineOperation({
        paramsSchema: companySchemas.params.destroy,
        authorizer: () => companyAuth.destroy,
        transaction: 'RUNS_IN',
        operation: async ({ prisma, params: { id } }) => {
            // The logo is on the company's side of the relation, so it does not cascade.
            const company = await prisma.company.delete({
                where: { id },
                select: { logoId: true },
            })
            await cmsImageOperations.destroy.internalCall({ params: { cmsImageId: company.logoId }, prisma })
        },
    }),
} as const
