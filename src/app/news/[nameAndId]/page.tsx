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
import { serverPage, withFallback } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

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
            <div className="flex flex-col gap-2 h-full">
                <Article
                    capabilities={capabilities}
                    articleClassName="bg-surface-base rounded-round overflow-y-auto p-[min(4rem,4vw)] grow mt-2"
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
                        <div className={[
                            'bg-surface-base rounded-round overflow-y-auto flex flex-col p-[min(4rem,4vw)] min-h-[80px]',
                            '[&>div]:flex [&>div]:gap-2 [&>div]:overflow-x-auto [&>div]:snap-x [&>div]:snap-mandatory',
                            '[&>div>*]:flex-[0_0_min(75%,300px)] [&>div>*]:snap-start',
                        ].join(' ')}>
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
