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
        <span className={styles.Article}>
            {hideCoverImage ? <></> : (
                <span className={`${coverImageClass} ${styles.coverImage}`}>
                    <CmsImage
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
            <article className={`${noMargin ? styles.noMargin : ''} ${articleClassName ?? ''}`}>
                {
                    article.articleSections.length ? (
                        article.articleSections.sort((a, b) => (a.order - b.order)).map((section, i) => (
                            <SlideInOnView direction="left" key={section.id}>
                                <span className={styles.moveSection}>
                                    <ArticleSection
                                        actions={actions.articleSections}
                                        articleSection={section}
                                        capabilities={capabilities}
                                    />
                                    <SectionMover
                                        capabilities={clientCapabilities}
                                        showUp={i !== 0}
                                        showDown={i !== article.articleSections.length - 1}
                                        className={styles.moverComponent}
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
                        <i className={styles.empty}>Denne artikkelen er tom</i>
                    )
                }
            </article>
            {sideBarContent && (
                <aside className={`${styles.sideBar} ${sideBarClassName}`}>
                    {sideBarContent}
                </aside>
            )}
            <div className={`${styles.addSection} ${addSectionClassName ?? ''}`}>
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
