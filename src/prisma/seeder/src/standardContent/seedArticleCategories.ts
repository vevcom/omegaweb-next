import { articleCategoryOperations } from '@/services/articleCategories/operations'
import { defineSeedOperation } from '@/seeder/src/defineSeedOperation'
import { upsert } from '@/seeder/src/upsert'
import { buildArticleFromConfig } from '@/seeder/src/buildArticleFromConfig'
import type { PrismaClient } from '@/prisma-generated-pn-client'
import type { Data } from '@/services/serviceOperation'
import type { SeedArticleConfig } from '@/seeder/src/buildArticleFromConfig'

type SeedArticleCategoryConfig = Pick<Data<typeof articleCategoryOperations.create>, 'name' | 'description'> & {
    articles: SeedArticleConfig[],
}

export const seedArticleCategoriesConfig = [
    {
        name: 'om omega',
        description: 'lær om omega',
        articles: [
            {
                name: 'om omega',
                coverImage: {
                    image: { dynamicImageSeededForCmsName: 'ohma' },
                },
                articleSections: [
                    {
                        cmsParagraph: {
                            file: 'about/about_1.md'
                        },
                        cmsLink: {
                            url: 'https://omega.ntnu.no',
                            text: 'Til forsiden'
                        }
                    },
                    {
                        cmsParagraph: {
                            file: 'about/about_2.md'
                        },
                        cmsImage: {
                            image: { dynamicImageSeededForCmsName: 'kappemann' },
                        }
                    }
                ]
            },
            {
                name: 'statutter',
                coverImage: {
                    image: { dynamicImageSeededForCmsName: 'ov' },
                },
                articleSections: [
                    {
                        cmsParagraph: {
                            file: 'statutter/statutter_1.md'
                        },
                        cmsLink: {
                            url: 'https://omega.ntnu.no',
                            text: 'Til forsiden'
                        }
                    },
                    {
                        cmsParagraph: {
                            file: 'statutter/statutter_2.md'
                        },
                        cmsImage: {
                            image: { dynamicImageSeededForCmsName: 'traktat' },
                        }
                    }
                ]
            },
        ]
    },
    {
        name: 'guider',
        description: 'få hjelp til ting',
        articles: [
            {
                name: 'prikkreglement',
                coverImage: {
                    image: { dynamicImageSeededForCmsName: 'ov' },
                },
                articleSections: [
                    {
                        cmsParagraph: {
                            file: 'prikkreglement/prikkreglement_1.md'
                        },
                        cmsImage: {
                            image: { dynamicImageSeededForCmsName: 'traktat' },
                        }
                    }
                ]
            },
            {
                name: 'søknadsguide',
                coverImage: {
                    image: { dynamicImageSeededForCmsName: 'ov' },
                },
                articleSections: [
                    {
                        cmsParagraph: {
                            file: 'soknadsguide/soknadsguide_1.md'
                        },
                        cmsImage: {
                            image: { dynamicImageSeededForCmsName: 'kappemann' },
                        }
                    }
                ]
            }
        ]
    }
] as const satisfies SeedArticleCategoryConfig[]

/**
 * This upserts the existance of all categories - an existing category is not changed.
 * Then upserts the existance of all articles in each category.
 * If the article exists - it is not changed at all
 * If the article does not exist - it is created with all its sections and content
 * given by the config.
 */
export const seedArticleCategories = defineSeedOperation(async (prisma) => {
    await Promise.all(seedArticleCategoriesConfig.map(async category => {
        const categoryResult = await upsert({
            checkExistence: () => articleCategoryOperations.read({ params: { name: category.name } }),
            create: () => articleCategoryOperations.create({
                // Standard content is readable by everyone and edited through the
                // ARTICLE_CATEGORY_ADMIN permission rather than by any group: a requirement with no
                // conditions can never be satisfied, so the admin level admits only those who bypass
                // it with that permission.
                data: {
                    name: category.name,
                    description: category.description,
                    visibilityRegularRequirements: [],
                    visibilityAdminRequirements: [{ conditions: [] }],
                }
            }),
            update: () => articleCategoryOperations.read({ params: { name: category.name } }),
        })

        for (const article of category.articles) {
            await upsertArticleInCategory(
                prisma,
                { id: categoryResult.id, name: category.name },
                article
            )
        }
    }))
})

async function upsertArticleInCategory(
    prisma: PrismaClient,
    articleCategory: { id: number, name: string },
    article: SeedArticleConfig
) {
    return upsert({
        checkExistence: () => prisma.article.findUnique({
            where: {
                articleCategoryId_name: { articleCategoryId: articleCategory.id, name: article.name }
            },
            select: { id: true }
        }),
        create: () => createArticleInCategory(prisma, articleCategory.id, article),
        update: () => Promise.resolve(),
    })
}

/**
 * This functions builds the article from config using the article operations.
 */
async function createArticleInCategory(
    prisma: PrismaClient,
    articleCategoryId: number,
    article: SeedArticleConfig
) {
    const createdArticle = await articleCategoryOperations.addArticleToCategory({
        params: { id: articleCategoryId }
    })

    await buildArticleFromConfig({
        updateName: data => articleCategoryOperations.updateArticle.update({
            implementationParams: { articleCategoryId },
            params: { articleId: createdArticle.id },
            data
        }),
        updateCoverImage: data => articleCategoryOperations.updateArticle.coverImage({
            implementationParams: { articleCategoryId },
            params: { cmsImageId: createdArticle.coverImage.id },
            data
        }),
        addSection: data => articleCategoryOperations.updateArticle.addSection({
            implementationParams: { articleCategoryId },
            params: { articleId: createdArticle.id },
            data
        }),
        updateSectionParagraph: (paragraphId, data) => articleCategoryOperations.updateArticle.articleSections.cmsParagraph({
            implementationParams: { articleCategoryId },
            params: { paragraphId },
            data
        }),
        updateSectionImage: (cmsImageId, data) => articleCategoryOperations.updateArticle.articleSections.cmsImage({
            implementationParams: { articleCategoryId },
            params: { cmsImageId },
            data
        }),
        updateSectionLink: (linkId, data) => articleCategoryOperations.updateArticle.articleSections.cmsLink({
            implementationParams: { articleCategoryId },
            params: { linkId },
            data
        }),
        article,
        prisma,
    })

    return createdArticle
}
