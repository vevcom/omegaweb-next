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
import getCommittee from '@/app/(omegaweb)/committees/[shortName]/getCommittee'
import { configureAction } from '@/services/configureAction'
import { committeeAuth } from '@/services/groups/committees/auth'
import { serverPage } from '@/app/ServerPage'
import { Require } from '@/auth/authorizer/Require'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params }: PageOperationArgs<{ shortName: string }>) => {
        const committee = await getCommittee(params.shortName)
        const article = await committeeOperations.readArticle({ params: { shortName: committee.shortName } })
        return { article, committee }
    },
    capabilities: (data) => ({
        // A pensioned committee is history: the service refuses every change to it.
        canEdit: Require.allOf(
            committeeAuth.updateArticle.data({ groupId: data.committee.groupId }),
            Require.custom(() => !data.committee.group.pensioned, { errorMessage: 'Komiteen er pensjonert' }),
        ),
    }),
    render: ({ data, capabilities }) => {
        const { shortName } = data.committee

        return (
            <div className="min-h-[500px]">
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
