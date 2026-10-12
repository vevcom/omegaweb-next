import styles from './page.module.scss'
import EditNews from './EditNews'
import CurrentNews from '@/app/news/CurrentNews'
import Article from '@/cms/Article/Article'
import {
    updateNewsArticleAction,
    updateNewsArticleAddSectionAction,
    updateNewsArticleCmsImageAction,
    updateNewsArticleCmsLinkAction,
    updateNewsArticleCmsParagraphAction,
    updateNewsArticleCoverImageAction,
    updateNewsArticleReorderSectionsAction,
    updateNewsArticleSectionAction,
    updateNewsArticleSectionsAddPartAction,
    updateNewsArticleSectionsRemovePartAction
} from '@/services/news/actions'
import { newsOperations } from '@/services/news/operations'
import SlideInOnView from '@/components/SlideInOnView/SlideInOnView'
import { decodeVevenUriHandleError } from '@/lib/urlEncoding'
import { configureAction } from '@/services/configureAction'
import { newsAuth } from '@/services/news/auth'
import { EMPTY_VISIBILITY } from '@/auth/visibility/emptyVisibility'
import { serverPage, withFallback } from '@/app/serverPage'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params }: PageOperationArgs<{ nameAndId: string }>) => {
        const news = await newsOperations.read({
            params: { id: decodeVevenUriHandleError(params.nameAndId) },
        })

        // Readable only by those who administrate the news article - a visitor without that
        // access simply gets no editing tools.
        const doubleLevelVisibility = await withFallback(
            newsOperations.visibility.readDoubleLevelMatrix({ params: { id: news.id } }),
            null
        )

        return { news, doubleLevelVisibility }
    },
    capabilities: (data) => ({
        canEdit: newsAuth.updateArticle.data({
            visibility: data.doubleLevelVisibility ?? EMPTY_VISIBILITY
        }),
    }),
    metadata: (data) => ({ title: data.news.article.name }),
    render: ({ data, capabilities }) => {
        const { news, doubleLevelVisibility } = data

        return (
            <div className={styles.wrapper}>
                <Article
                    capabilities={capabilities}
                    articleClassName={styles.article}
                    article={news.article}
                    actions={{
                        updateArticleAction: configureAction(
                            updateNewsArticleAction,
                            { implementationParams: { newsId: news.id } }
                        ),
                        updateCoverImageAction: configureAction(
                            updateNewsArticleCoverImageAction,
                            { implementationParams: { newsId: news.id } }
                        ),
                        addSectionToArticleAction: configureAction(
                            updateNewsArticleAddSectionAction,
                            { implementationParams: { newsId: news.id } }
                        ),
                        reorderArticleSectionsAction: configureAction(
                            updateNewsArticleReorderSectionsAction,
                            { implementationParams: { newsId: news.id } }
                        ),
                        articleSections: {
                            updateCmsParagraph: configureAction(
                                updateNewsArticleCmsParagraphAction,
                                { implementationParams: { newsId: news.id } }
                            ),
                            updateCmsImage: configureAction(
                                updateNewsArticleCmsImageAction,
                                { implementationParams: { newsId: news.id } }
                            ),
                            updateCmsLink: configureAction(
                                updateNewsArticleCmsLinkAction,
                                { implementationParams: { newsId: news.id } }
                            ),
                            updateArticleSection: configureAction(
                                updateNewsArticleSectionAction,
                                { implementationParams: { newsId: news.id } }
                            ),
                            addPartToArticleSection: configureAction(
                                updateNewsArticleSectionsAddPartAction,
                                { implementationParams: { newsId: news.id } }
                            ),
                            removePartFromArticleSection: configureAction(
                                updateNewsArticleSectionsRemovePartAction,
                                { implementationParams: { newsId: news.id } }
                            )
                        }
                    }}
                />
                <SlideInOnView>
                    <EditNews news={news} doubleLevelVisibility={doubleLevelVisibility}>
                        <div className={styles.moreNews}>
                            <h1>Flere nyheter</h1>
                            <div>
                                <CurrentNews not={news.id} />
                            </div>
                        </div>
                    </EditNews>
                </SlideInOnView>
            </div>
        )
    },
})

export default page
export { generateMetadata }
