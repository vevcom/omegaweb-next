import styles from './Article.module.scss'
import ReorderableSections from './ReorderableSections'
import ChangeName from './ChangeName'
import EmptyArticle from './EmptyArticle'
import CmsImage from '@/cms/CmsImage/CmsImage'
import { configureAction } from '@/services/configureAction'
import { capabilitiesToJsObject } from '@/auth/authorizer/capabilities'
import ArticleSection, {
    type ArticleSectionActions
} from '@/cms/ArticleSection/ArticleSection'
import type { ReactNode } from 'react'
import type {
    AddSectionToArticleAction,
    ExpandedArticle,
    ReorderArticleSectionsAction,
    UpdateArticleAction
} from '@/cms/articles/types'
import type { UpdateCmsImageAction } from '@/cms/images/types'
import type { Capabilities } from '@/auth/authorizer/capabilities'

export type PropTypes = {
    article: ExpandedArticle,
    coverImageClass?: string,
    hideCoverImage?: boolean
    noMargin?: boolean
    /** For a page without a panel behind it: the sections reach its edges as the cover image does, which is rounded. */
    islands?: boolean
    sideBarContent?: ReactNode
    sideBarClassName?: string
    articleClassName?: string
    /** Shows "Denne artikkelen er tom" in edit mode only, to the one who may fill the article. */
    emptyTextOnlyInEditMode?: boolean
    actions: {
        updateCoverImageAction: UpdateCmsImageAction,
        updateArticleAction: UpdateArticleAction,
        addSectionToArticleAction: AddSectionToArticleAction,
        reorderArticleSectionsAction: ReorderArticleSectionsAction,
        articleSections: ArticleSectionActions
    }
    capabilities: Capabilities<'canEdit'>
}

export default function Article({
    article,
    coverImageClass,
    hideCoverImage = false,
    noMargin = false,
    islands = false,
    sideBarContent,
    sideBarClassName,
    articleClassName,
    emptyTextOnlyInEditMode = false,
    actions,
    capabilities,
}: PropTypes) {
    const clientCapabilities = capabilitiesToJsObject(capabilities)

    return (
        <span className="
            h-full grid grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_1fr]
            [grid-template-areas:'coverImage_coverImage'_'article_sideBar']
            max-mobile:grid-cols-[minmax(0,1fr)] max-mobile:grid-rows-[auto_1fr_auto]
            max-mobile:[grid-template-areas:'coverImage'_'article'_'sideBar']
        ">
            {hideCoverImage ? <></> : (
                <span className={`
                    ${coverImageClass}
                    ${islands ? 'rounded-round' : 'rounded-t-round'}
                    [grid-area:coverImage] overflow-hidden isolate block w-full h-[min(300px,40vh)] relative
                    [&>*:nth-child(3)]:absolute [&>*:nth-child(3)]:left-4 [&>*:nth-child(3)]:bottom-4
                    [&>*:nth-child(3)]:right-4 [&>*:nth-child(3)]:wrap-anywhere
                `}>
                    <CmsImage
                        className="
                            relative w-full h-full
                            after:absolute after:top-0 after:left-0 after:w-full after:h-full after:z-1
                            [&_div]:w-full [&_div]:h-full
                            [&_img]:absolute [&_img]:top-0 [&_img]:left-0 [&_img]:w-full [&_img]:h-[min(300px,40vh)]!
                            [&_img]:object-cover
                        "
                        width={500}
                        sizes="100vw"
                        cmsImage={article.coverImage}
                        updateCmsImageAction={actions.updateCoverImageAction}
                        capabilities={capabilities}
                    />
                    <div className="absolute top-0 left-0 w-full h-full bg-black/30 object-cover pointer-events-none" ></div>
                    <ChangeName
                        article={article}
                        updateArticleAction={
                            configureAction(
                                actions.updateArticleAction,
                                { params: { articleId: article.id } }
                            )
                        }
                        capabilities={clientCapabilities}
                    />
                </span>
            )}
            <article
                className={`
                    [grid-area:article] isolate
                    ${islands ? '[&>*]:my-2' : 'p-4'}
                    [&>*]:isolate [&>*]:relative
                    ${styles.article}
                    ${noMargin || islands ? '' : `
                        [&>*]:my-4
                        [&>*:last-child]:mb-0
                    `}
                    ${noMargin ? '[&>*]:m-0' : ''}
                    ${hideCoverImage && 'rounded-t-round'}
                    ${articleClassName ?? ''}
                `}
            >
                {
                    article.articleSections.length === 0 &&
                        <EmptyArticle onlyInEditMode={emptyTextOnlyInEditMode} capabilities={clientCapabilities} />
                }
                <ReorderableSections
                    capabilities={clientCapabilities}
                    reorderArticleSectionsAction={
                        configureAction(
                            actions.reorderArticleSectionsAction,
                            { params: { articleId: article.id } }
                        )
                    }
                    addSectionToArticleAction={
                        configureAction(
                            actions.addSectionToArticleAction,
                            { params: { articleId: article.id } }
                        )
                    }
                    sections={article.articleSections.toSorted((a, b) => a.order - b.order).map(section => ({
                        id: section.id,
                        node: <ArticleSection
                            actions={actions.articleSections}
                            articleSection={section}
                            capabilities={capabilities}
                        />,
                    }))}
                />

            </article>
            {sideBarContent && (
                <aside className={`
                    [grid-area:sideBar]
                    ${sideBarClassName}
                `}>
                    {sideBarContent}
                </aside>
            )}
        </span>
    )
}
