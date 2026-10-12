import styles from './page.module.scss'
import {
    updateCommitteeArticleAction,
    updateCommitteeArticleAddSectionAction,
    updateCommitteeArticleCmsImageAction,
    updateCommitteeArticleCmsLinkAction,
    updateCommitteeArticleCmsParagraphAction,
    updateCommitteeArticleCoverImageAction,
    updateCommitteeArticleReorderSectionsAction,
    updateCommitteeArticleSectionAction,
    updateCommitteeArticleSectionsAddPartAction,
    updateCommitteeArticleSectionsRemovePartAction
} from '@/services/groups/committees/actions'
import { committeeOperations } from '@/services/groups/committees/operations'
import Article from '@/components/Cms/Article/Article'
import getCommittee from '@/app/committees/[shortName]/getCommittee'
import { configureAction } from '@/services/configureAction'
import { committeeAuth } from '@/services/groups/committees/auth'
import { serverPage } from '@/app/serverPage'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params }: PageOperationArgs<{ shortName: string }>) => {
        const committee = await getCommittee(params.shortName)
        const article = await committeeOperations.readArticle({ params: { shortName: committee.shortName } })
        return { article, committee }
    },
    capabilities: (data) => ({
        canEdit: committeeAuth.updateArticle.data({ groupId: data.committee.groupId }),
    }),
    render: ({ data, capabilities }) => {
        const { shortName } = data.committee

        return (
            <div className={styles.wrapper}>
                <Article
                    capabilities={capabilities}
                    article={data.article}
                    hideCoverImage
                    noMargin
                    actions={{
                        updateArticleAction: configureAction(
                            updateCommitteeArticleAction,
                            { implementationParams: { shortName } }
                        ),
                        updateCoverImageAction: configureAction(
                            updateCommitteeArticleCoverImageAction,
                            { implementationParams: { shortName } }
                        ),
                        addSectionToArticleAction: configureAction(
                            updateCommitteeArticleAddSectionAction,
                            { implementationParams: { shortName } }
                        ),
                        reorderArticleSectionsAction: configureAction(
                            updateCommitteeArticleReorderSectionsAction,
                            { implementationParams: { shortName } }
                        ),
                        articleSections: {
                            updateCmsParagraph: configureAction(
                                updateCommitteeArticleCmsParagraphAction,
                                { implementationParams: { shortName } }
                            ),
                            updateCmsImage: configureAction(
                                updateCommitteeArticleCmsImageAction,
                                { implementationParams: { shortName } }
                            ),
                            updateCmsLink: configureAction(
                                updateCommitteeArticleCmsLinkAction,
                                { implementationParams: { shortName } }
                            ),
                            updateArticleSection: configureAction(
                                updateCommitteeArticleSectionAction,
                                { implementationParams: { shortName } }
                            ),
                            addPartToArticleSection: configureAction(
                                updateCommitteeArticleSectionsAddPartAction,
                                { implementationParams: { shortName } }
                            ),
                            removePartFromArticleSection: configureAction(
                                updateCommitteeArticleSectionsRemovePartAction,
                                { implementationParams: { shortName } }
                            )
                        }
                    }}
                />
            </div>
        )
    },
})

export default page
export { generateMetadata }
