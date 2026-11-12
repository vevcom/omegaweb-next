import '@pn-server-only'
import { companyAuth } from './auth'
import {
    companySponsorOrdering,
    logoIncluder,
    sponsorSelection,
} from './constants'
import { companySchemas } from './schemas'
import { companyLogoImageOperations } from './companyLogoCollection'
import { defineOperation } from '@/services/serviceOperation'
import { takeAdvisoryLock } from '@/lib/advisoryLocks'
import { cursorPagingSelection } from '@/lib/paging/cursorPagingSelection'
import { implementSearchOperation } from '@/services/search/implement'
import { careerLinks } from '@/app/(careers)/links'
import { CompanySponsorTier } from '@/prisma-generated-pn-types'
import type { CompanyExpanded, SponsorCompany } from './types'

export const companyOperations = {
    create: defineOperation({
        dataSchema: companySchemas.data.create,
        authorizer: () => companyAuth.create,
        operation: ({ prisma, data }) => prisma.company.create({ data }),
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
    read: defineOperation({
        paramsSchema: companySchemas.params.read,
        authorizer: ({ params }) => companyAuth.read.data({ companyId: params.id }),
        operation: ({ prisma, params: { id } }): Promise<CompanyExpanded> => prisma.company.findUniqueOrThrow({
            where: { id },
            include: logoIncluder,
        }),
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
        toSearchResult: company => ({
            key: `company-${company.id}`,
            href: careerLinks.company(company),
            label: company.name,
            image: company.logoImage,
        }),
    }),
    update: defineOperation({
        paramsSchema: companySchemas.params.update,
        dataSchema: companySchemas.data.update,
        authorizer: ({ params }) => companyAuth.update.data({ companyId: params.id }),
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
    updateLogo: defineOperation({
        paramsSchema: companySchemas.params.updateLogo,
        dataSchema: companySchemas.data.updateLogo,
        authorizer: ({ params }) => companyAuth.updateLogo.data({ companyId: params.id }),
        transaction: 'OPENS',
        operation: async ({ prisma, params: { id }, data }) =>
            // The upload writes the file before the database, so it needs more than the default
            // transaction timeout.
            prisma.$transaction(async tx => {
                const company = await tx.company.findUniqueOrThrow({
                    where: { id },
                    select: { name: true, logoImageId: true },
                })
                const uploadedImage = await companyLogoImageOperations.uploadImage.internalCall({
                    prisma: tx,
                    data: {
                        imageFile: data.imageFile,
                        imageName: 'Logo',
                        imageAlt: `Logoen til ${company.name}`.slice(0, 100),
                    },
                })
                await tx.company.update({
                    where: { id },
                    data: { logoImageId: uploadedImage.id },
                })
                // The previous logo is an upload owned by this company alone, so nothing else shows it.
                if (company.logoImageId !== null) {
                    await companyLogoImageOperations.destroyImage.internalCall({
                        prisma: tx,
                        params: { imageId: company.logoImageId },
                    })
                }
                return uploadedImage
            }, { timeout: 20000 }),
    }),
    destroy: defineOperation({
        paramsSchema: companySchemas.params.destroy,
        authorizer: () => companyAuth.destroy,
        transaction: 'OPENS',
        operation: async ({ prisma, params: { id } }) => {
            await prisma.$transaction(async tx => {
                const company = await tx.company.delete({
                    where: { id },
                    select: { logoImageId: true },
                })
                if (company.logoImageId !== null) {
                    await companyLogoImageOperations.destroyImage.internalCall({
                        prisma: tx,
                        params: { imageId: company.logoImageId },
                    })
                }
            })
        },
    }),
} as const
