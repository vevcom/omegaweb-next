import styles from './page.module.scss'
import Article from '@/cms/Article/Article'
import { configureAction } from '@/services/configureAction'
import {
    updateArticleCategoryArticleAction,
    updateArticleCategoryArticleAddSectionAction,
    updateArticleCategoryArticleCmsImageAction,
    updateArticleCategoryArticleCmsLinkAction,
    updateArticleCategoryArticleCmsParagraphAction,
    updateArticleCategoryArticleCoverImageAction,
    updateArticleCategoryArticleReorderSectionsAction,
    updateArticleCategoryArticleSectionAction,
    updateArticleCategoryArticleSectionsAddPartAction,
    updateArticleCategoryArticleSectionsRemovePartAction
} from '@/services/articleCategories/actions'
import { articleCategoryOperations } from '@/services/articleCategories/operations'
import { decodeVevenUriHandleError } from '@/lib/urlEncoding'
import { articleCategoryAuth } from '@/services/articleCategories/auth'
import { serverPage } from '@/app/serverPage'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params }: PageOperationArgs<{ category: string, nameAndId: string }>) => {
        const articleId = decodeVevenUriHandleError(params.nameAndId)
        const categoryName = decodeURIComponent(params.category)

        const [articleCategory, article] = await Promise.all([
            articleCategoryOperations.read({ params: { name: categoryName } }),
            articleCategoryOperations.readArticleInCategory({
                implementationParams: {
                    articleCategoryName: categoryName,
                },
                params: {
                    articleId,
                },
            }),
        ])

        return { articleCategory, article }
    },
    capabilities: (data) => ({
        canEdit: articleCategoryAuth.updateArticle.data({ visibility: data.articleCategory.visibility }),
    }),
    metadata: (data) => ({ title: data.article.name }),
    render: ({ data, capabilities }) => (
        <div className={styles.wrapper}>
            <Article
                capabilities={capabilities}
                coverImageClass={styles.coverImage}
                article={data.article}
                actions={{
                    updateArticleAction: configureAction(
                        updateArticleCategoryArticleAction,
                        { implementationParams: { articleCategoryId: data.articleCategory.id } }
                    ),
                    updateCoverImageAction: configureAction(
                        updateArticleCategoryArticleCoverImageAction,
                        { implementationParams: { articleCategoryId: data.articleCategory.id } }
                    ),
                    addSectionToArticleAction: configureAction(
                        updateArticleCategoryArticleAddSectionAction,
                        { implementationParams: { articleCategoryId: data.articleCategory.id } }
                    ),
                    reorderArticleSectionsAction: configureAction(
                        updateArticleCategoryArticleReorderSectionsAction,
                        { implementationParams: { articleCategoryId: data.articleCategory.id } }
                    ),
                    articleSections: {
                        updateCmsParagraph: configureAction(
                            updateArticleCategoryArticleCmsParagraphAction,
                            { implementationParams: { articleCategoryId: data.articleCategory.id } }
                        ),
                        updateCmsImage: configureAction(
                            updateArticleCategoryArticleCmsImageAction,
                            { implementationParams: { articleCategoryId: data.articleCategory.id } }
                        ),
                        updateCmsLink: configureAction(
                            updateArticleCategoryArticleCmsLinkAction,
                            { implementationParams: { articleCategoryId: data.articleCategory.id } }
                        ),
                        updateArticleSection: configureAction(
                            updateArticleCategoryArticleSectionAction,
                            { implementationParams: { articleCategoryId: data.articleCategory.id } }
                        ),
                        addPartToArticleSection: configureAction(
                            updateArticleCategoryArticleSectionsAddPartAction,
                            { implementationParams: { articleCategoryId: data.articleCategory.id } }
                        ),
                        removePartFromArticleSection: configureAction(
                            updateArticleCategoryArticleSectionsRemovePartAction,
                            { implementationParams: { articleCategoryId: data.articleCategory.id } }
                        )
                    }
                }}
            />
        </div>
    ),
})

export default page
export { generateMetadata }
