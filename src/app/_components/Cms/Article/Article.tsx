import styles from './Article.module.scss'
import AddSection from './AddSection'
import SectionMover from './SectionMover'
import ChangeName from './ChangeName'
import CmsImage from '@/cms/CmsImage/CmsImage'
import SlideInOnView from '@/components/SlideInOnView/SlideInOnView'
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
    sideBarContent?: ReactNode
    sideBarClassName?: string
    articleClassName?: string
    addSectionClassName?: string
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
    sideBarContent,
    sideBarClassName,
    articleClassName,
    addSectionClassName,
    actions,
    capabilities,
}: PropTypes) {
    const clientCapabilities = capabilitiesToJsObject(capabilities)

    return (
        <span className="
            h-full grid grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_1fr_auto]
            [grid-template-areas:'coverImage_coverImage'_'article_sideBar'_'addSection_sideBar']
            max-mobile:grid-cols-[minmax(0,1fr)] max-mobile:grid-rows-[auto_1fr_auto_auto]
            max-mobile:[grid-template-areas:'coverImage'_'article'_'addSection'_'sideBar']
        ">
            {hideCoverImage ? <></> : (
                <span className={`
                    ${coverImageClass}
                    rounded-round [grid-area:coverImage] overflow-hidden isolate block w-full h-[min(300px,40vh)] relative
                    [&>*:nth-child(2)]:absolute [&>*:nth-child(2)]:left-[min(4rem,4vw)] [&>*:nth-child(2)]:bottom-[1em]
                    [&>*:nth-child(2)]:right-[min(4rem,4vw)] [&>*:nth-child(2)]:wrap-anywhere
                `}>
                    <CmsImage
                        className="
                            relative w-full h-full
                            after:absolute after:top-0 after:left-0 after:w-full after:h-full after:z-1
                            after:bg-[linear-gradient(to_bottom,transparent_50%,var(--surface-base))]
                            [&_div]:w-full [&_div]:h-full
                            [&_img]:absolute [&_img]:top-0 [&_img]:left-0 [&_img]:w-full [&_img]:h-[min(300px,40vh)]!
                            [&_img]:object-cover
                        "
                        width={500}
                        cmsImage={article.coverImage}
                        updateCmsImageAction={actions.updateCoverImageAction}
                        capabilities={capabilities}
                    />
                    <SlideInOnView direction="bottom">
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
                    </SlideInOnView>
                </span>
            )}
            <article
                className={`
                    [grid-area:article] isolate
                    [&>*]:isolate [&>*]:relative
                    ${styles.article}
                    ${noMargin ? '[&>*]:m-0' : `
                        [&>*]:my-[2em] [&>*]:mx-[min(4rem,4vw)]
                        [&>*:last-child]:mb-[1em]
                    `}
                    ${articleClassName ?? ''}
                `}
            >
                {
                    article.articleSections.length ? (
                        article.articleSections.sort((a, b) => (a.order - b.order)).map((section, i) => (
                            <SlideInOnView direction="left" key={section.id}>
                                <span className="relative block">
                                    <ArticleSection
                                        actions={actions.articleSections}
                                        articleSection={section}
                                        capabilities={capabilities}
                                    />
                                    <SectionMover
                                        capabilities={clientCapabilities}
                                        showUp={i !== 0}
                                        showDown={i !== article.articleSections.length - 1}
                                        className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-[40%] z-2"
                                        reorderArticleSectionsAction={
                                            configureAction(
                                                actions.reorderArticleSectionsAction,
                                                {
                                                    params: {
                                                        articleId: article.id,
                                                        sectionId: section.id
                                                    }
                                                }
                                            )
                                        }
                                    />
                                </span>
                            </SlideInOnView>
                        ))
                    ) : (
                        <i className="flex h-[2em]">Denne artikkelen er tom</i>
                    )
                }
            </article>
            {sideBarContent && (
                <aside className={`
                    [grid-area:sideBar]
                    ${sideBarClassName}
                `}>
                    {sideBarContent}
                </aside>
            )}
            <div className={`
                [grid-area:addSection] my-0 mx-[min(4rem,4vw)]
                ${addSectionClassName ?? ''}
            `}>
                <AddSection
                    capabilities={clientCapabilities}
                    currentNumberSections={article.articleSections.length}
                    addSectionToArticleAction={
                        configureAction(
                            actions.addSectionToArticleAction,
                            { params: { articleId: article.id } }
                        )
                    }
                />
            </div>
        </span>
    )
}
