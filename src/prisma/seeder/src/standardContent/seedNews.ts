import { newsOperations } from '@/services/news/operations'
import { defineSeedOperation } from '@/seeder/src/defineSeedOperation'
import { upsert } from '@/seeder/src/upsert'
import { buildArticleFromConfig } from '@/seeder/src/buildArticleFromConfig'
import type { PrismaClient } from '@/prisma-generated-pn-client'
import type { Data } from '@/services/serviceOperation'
import type { SeedArticleConfig } from '@/seeder/src/buildArticleFromConfig'

type SeedNewsConfig = Pick<Data<typeof newsOperations.create>, 'description'> & {
    article: SeedArticleConfig,
}

export const seedNewsConfig = [
    {
        description: 'ny vev',
        article: {
            name: 'Velkommen til nye veven',
            coverImage: {
                image: { standardImage: 'LOGO_SIMPLE' },
            },
            articleSections: [
                {
                    cmsParagraph: {
                        file: 'news/velkommen_til_nye_veven_1.md'
                    },
                    cmsImage: {
                        image: { dynamicImageSeededForCmsName: 'kappemann' },
                    }
                }
            ]
        }
    },
] as const satisfies SeedNewsConfig[]

/**
 * Upserts all news articles given by the config.
 */
export const seedNews = defineSeedOperation(async (prisma: PrismaClient) => {
    await Promise.all(seedNewsConfig.map(news => upsertNews(prisma, news)))
})

/**
 * There is no service operation to look up a news article by name (only by id), so existence is
 * checked with a plain prisma read. On update nothing is touched - an admin may have since edited
 * the news article's content through the CMS, so existing content is never reconciled with the
 * seed config.
 */
async function upsertNews(prisma: PrismaClient, news: SeedNewsConfig) {
    return upsert({
        checkExistence: () => prisma.newsArticle.findFirst({
            where: { articleName: news.article.name },
            select: { id: true }
        }),
        create: () => createNews(prisma, news),
        update: () => Promise.resolve(),
    })
}

async function createNews(prisma: PrismaClient, news: SeedNewsConfig) {
    const createdNews = await newsOperations.create({
        // Standard content is administrated through the NEWS_ADMIN permission rather than by any
        // group: a requirement with no conditions can never be satisfied, so the admin level admits
        // only those who bypass it with that permission.
        data: {
            name: news.article.name,
            description: news.description,
            visibilityAdminRequirements: [{ conditions: [] }],
        }
    })

    await buildArticleFromConfig({
        updateName: data => newsOperations.updateArticle.update({
            implementationParams: { newsId: createdNews.id },
            params: { articleId: createdNews.article.id },
            data
        }),
        updateCoverImage: data => newsOperations.updateArticle.coverImage({
            implementationParams: { newsId: createdNews.id },
            params: { cmsImageId: createdNews.article.coverImage.id },
            data
        }),
        addSection: data => newsOperations.updateArticle.addSection({
            implementationParams: { newsId: createdNews.id },
            params: { articleId: createdNews.article.id },
            data
        }),
        updateSectionParagraph: (paragraphId, data) => newsOperations.updateArticle.articleSections.cmsParagraph({
            implementationParams: { newsId: createdNews.id },
            params: { paragraphId },
            data
        }),
        updateSectionImage: (cmsImageId, data) => newsOperations.updateArticle.articleSections.cmsImage({
            implementationParams: { newsId: createdNews.id },
            params: { cmsImageId },
            data
        }),
        updateSectionLink: (linkId, data) => newsOperations.updateArticle.articleSections.cmsLink({
            implementationParams: { newsId: createdNews.id },
            params: { linkId },
            data
        }),
        article: news.article,
        prisma,
    })

    return createdNews
}
