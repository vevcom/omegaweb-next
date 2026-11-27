import '@ow-server-only'
import { jobAdAuth } from './auth'
import { jobAdSchemas } from './schemas'
import { activeJobAdOrdering, articleAndCompanyIncluder, simpleArticleAndCompanyIncluder } from './constants'
import { newJobAdNotificationChannel } from './newJobAdNotificationChannel'
import { omegaJobAdLinks } from '@/app/(omegaweb)/job-ads/links'
import { logoIncluder } from '@/services/careers/companies/constants'
import { jobAdLinks } from '@/pageKits/jobAds/links'
import { defineOperation } from '@/services/serviceOperation'
import { cursorPagingSelection } from '@/lib/paging/cursorPagingSelection'
import { implementArticleOperations } from '@/cms/articles/implement'
import { implementSearchOperation } from '@/services/search/implement'
import type { ExpandedJobAd, SimpleJobAd } from './types'
import type { Prisma } from '@/prisma-generated-pn-types'
import type { SearchFindArgs } from '@/services/search/implement'
import type { JobAdPagesConfig } from '@/pageKits/jobAds/config'

const read = defineOperation({
    paramsSchema: jobAdSchemas.params.read,
    authorizer: async ({ prisma, params }) => jobAdAuth.read.data(await prisma.jobAd.findUniqueOrThrow({
        where: { id: params.id },
        select: { companyId: true },
    })),
    operation: async ({ prisma, params }): Promise<ExpandedJobAd> => await prisma.jobAd.findUniqueOrThrow({
        where: {
            id: params.id,
        },
        include: {
            ...articleAndCompanyIncluder,
            company: {
                include: logoIncluder,
            }
        }
    })
})

const article = implementArticleOperations({
    maxNameLength: 30,
    authorizer: () => jobAdAuth.updateArticle,
    implementationParamsSchema: jobAdSchemas.params.article,
    ownedArticles: async ({ implementationParams }) => {
        const jobAd = await read({ params: { id: implementationParams.jobAdId }, bypassAuth: true })
        return [jobAd.article]
    }
})

export const jobAdOperations = {
    create: defineOperation({
        dataSchema: jobAdSchemas.data.create,
        authorizer: () => jobAdAuth.create,
        transaction: 'OPENS',
        operation: async ({ prisma, data: { articleName, companyId, ...data } }) => {
            const jobAd = await prisma.$transaction(async tx => {
                const createdArticle = await article.internal.create.internalCall({
                    prisma: tx,
                    data: { name: articleName },
                })

                return tx.jobAd.create({
                    data: {
                        article: {
                            connect: {
                                id: createdArticle.id
                            }
                        },
                        company: {
                            connect: {
                                id: companyId
                            }
                        },
                        ...data,
                    },
                    include: {
                        company: {
                            select: {
                                name: true,
                            },
                        },
                    },
                })
            })

            await newJobAdNotificationChannel.internal.createNotification.internalCall({
                data: {
                    title: `Ny jobbannonse: ${articleName}`,
                    message: `${jobAd.company.name} har lagt ut en ny jobbannonse: ${articleName}`,
                    url: omegaJobAdLinks.jobAd({ articleName, id: jobAd.id }),
                    audience: { permission: 'JOBAD_USE' },
                },
            })

            return jobAd
        }
    }),
    /**
     * This handler reads a jobAd by id or articleName and order
     * @param idOrName - id or articleName and order of jobAd to read (id or {articleName: string, order: number})
     * @returns ExpandedJobAd - the jobAd and its article
     */
    read,
    /** Every job ad of the company, the active ones first. */
    readOfCompany: defineOperation({
        paramsSchema: jobAdSchemas.params.readOfCompany,
        authorizer: ({ params }) => jobAdAuth.readOfCompany.data({ companyId: params.companyId }),
        operation: async ({ prisma, params }): Promise<SimpleJobAd[]> => {
            const jobAds = await prisma.jobAd.findMany({
                orderBy: [{ active: 'desc' }, ...activeJobAdOrdering],
                where: {
                    companyId: params.companyId,
                },
                include: simpleArticleAndCompanyIncluder,
            })
            return jobAds.map(toSimpleJobAd)
        }
    }),
    /**
     * This handler reads all active jobAds
     * @returns SimpleJobAd[] - all jobAds with coverImage
     */
    readActive: defineOperation({
        authorizer: () => jobAdAuth.readActive,
        operation: async ({ prisma }): Promise<SimpleJobAd[]> => {
            const jobAds = await prisma.jobAd.findMany({
                orderBy: activeJobAdOrdering,
                where: {
                    active: true,
                },
                include: simpleArticleAndCompanyIncluder,
            })
            return jobAds.map(toSimpleJobAd)
        }
    }),
    /** The search for a site's job ad pages: the same matches on both sites, linking to the site's own. */
    search: implementSearchOperation({
        authorizer: () => jobAdAuth.search,
        find: ({ prisma, query, take }: SearchFindArgs<undefined, JobAdPagesConfig>) => prisma.jobAd.findMany({
            take,
            where: {
                OR: [
                    { article: { name: { contains: query, mode: 'insensitive' } } },
                    { company: { name: { contains: query, mode: 'insensitive' } } },
                ],
            },
            orderBy: [{ active: 'desc' }, ...activeJobAdOrdering],
            select: {
                id: true,
                active: true,
                article: { select: { name: true } },
                company: { select: { name: true } },
            },
        }),
        toSearchResult: (jobAd, config) => ({
            key: `job-ad-${jobAd.id}`,
            href: jobAdLinks(config).jobAd({ articleName: jobAd.article.name, id: jobAd.id }),
            label: jobAd.article.name,
            sublabel: jobAd.active ? jobAd.company.name : `${jobAd.company.name} (utløpt)`,
            image: null,
        }),
    }),
    /**
     * This handler reads a page of inactive jobAds
     * @param paging - the page to read, includes details to filter by name (articleName) and the type.
     */
    readInactivePage: defineOperation({
        paramsSchema: jobAdSchemas.params.readInactivePage,
        authorizer: () => jobAdAuth.readInactivePage,
        operation: async ({ prisma, params }): Promise<SimpleJobAd[]> => {
            const jobAds = await prisma.jobAd.findMany({
                ...cursorPagingSelection(params.paging.page),
                where: {
                    active: false,
                    article: {
                        name: {
                            contains: params.paging.details.name || '',
                            mode: 'insensitive',
                        }
                    },
                    type: params.paging.details.type || undefined,
                },
                include: simpleArticleAndCompanyIncluder,
            })
            return jobAds.map(toSimpleJobAd)
        }
    }),
    /**
     * This handler destroys a jobAd. It is also responsible for cleaning up the article,
     * to avoid orphaned articles. It calls destroyArticle to destroy the article and its coverImage (cmsImage)
     * @param id - id of news article to destroy
     * @returns
     */
    update: defineOperation({
        paramsSchema: jobAdSchemas.params.update,
        dataSchema: jobAdSchemas.data.update,
        authorizer: () => jobAdAuth.update,
        operation: async ({ prisma, params: { id }, data }) => await prisma.jobAd.update({
            where: { id },
            data,
        })
    }),
    article,
    destroy: defineOperation({
        paramsSchema: jobAdSchemas.params.destroy,
        authorizer: () => jobAdAuth.destroy,
        operation: async ({ prisma, params: { id } }) => {
            const jobAd = await prisma.jobAd.delete({
                where: { id },
            })
            await article.internal.destroy.internalCall({ params: { articleId: jobAd.articleId } })
        }
    }),
} as const

function toSimpleJobAd(jobAd: Prisma.JobAdGetPayload<{ include: typeof simpleArticleAndCompanyIncluder }>): SimpleJobAd {
    return {
        ...jobAd,
        coverImage: jobAd.article.coverImage.image,
        companyName: jobAd.company.name,
        companySponsorTier: jobAd.company.sponsorTier,
    }
}
