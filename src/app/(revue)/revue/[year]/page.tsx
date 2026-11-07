import CreateRevueGroup from './CreateRevueGroup'
import RevueSettings from './RevueSettings'
import yearFromParam from './yearFromParam'
import { revueLinks } from '@/app/(revue)/links'
import {
    updateRevueArticleAction,
    updateRevueArticleAddSectionAction,
    updateRevueArticleCmsImageAction,
    updateRevueArticleCmsLinkAction,
    updateRevueArticleCmsParagraphAction,
    updateRevueArticleCoverImageAction,
    updateRevueArticleReorderSectionsAction,
    updateRevueArticleSectionAction,
    updateRevueArticleSectionsAddPartAction,
    updateRevueArticleSectionsRemovePartAction,
} from '@/services/revue/actions'
import { revueAuth } from '@/services/revue/auth'
import { revueOperations } from '@/services/revue/operations'
import Article from '@/components/Cms/Article/Article'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import SiteLink from '@/components/SiteLink/SiteLink'
import { configureAction } from '@/services/configureAction'
import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params }: PageOperationArgs<{ year: string }>) => revueOperations.read({
        params: { year: yearFromParam(params.year) },
    }),
    capabilities: () => ({
        canEdit: revueAuth.updateArticle,
    }),
    metadata: revue => ({ title: revue.name }),
    render: ({ data: revue, capabilities }) => {
        const actionConfig = { implementationParams: { revueId: revue.id } }

        return (
            <PageWrapper>
                <div className="flex justify-between items-center mb-4">
                    <SiteLink href={revueLinks.frontpage()}>Alle revyer</SiteLink>
                    <RevueSettings revue={revue} />
                </div>
                <Article
                    article={revue.article}
                    capabilities={capabilities}
                    actions={{
                        updateArticleAction: configureAction(updateRevueArticleAction, actionConfig),
                        updateCoverImageAction: configureAction(updateRevueArticleCoverImageAction, actionConfig),
                        addSectionToArticleAction: configureAction(updateRevueArticleAddSectionAction, actionConfig),
                        reorderArticleSectionsAction: configureAction(
                            updateRevueArticleReorderSectionsAction, actionConfig
                        ),
                        articleSections: {
                            updateCmsParagraph: configureAction(updateRevueArticleCmsParagraphAction, actionConfig),
                            updateCmsImage: configureAction(updateRevueArticleCmsImageAction, actionConfig),
                            updateCmsLink: configureAction(updateRevueArticleCmsLinkAction, actionConfig),
                            updateArticleSection: configureAction(updateRevueArticleSectionAction, actionConfig),
                            addPartToArticleSection: configureAction(
                                updateRevueArticleSectionsAddPartAction, actionConfig
                            ),
                            removePartFromArticleSection: configureAction(
                                updateRevueArticleSectionsRemovePartAction, actionConfig
                            ),
                        },
                    }}
                />
                <section className="mt-8">
                    <h2>Undergrupper</h2>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4 mt-4">
                        {revue.groups.map(group => (
                            <SiteLink
                                key={group.id}
                                href={revueLinks.revueGroup(revue, group)}
                                className="
                                    block p-4 rounded-round bg-surface-raised text-inherit transition-colors
                                    hover:bg-surface-hover hover:no-underline
                                "
                            >
                                {group.name}
                            </SiteLink>
                        ))}
                        <CreateRevueGroup revue={revue} />
                    </div>
                </section>
            </PageWrapper>
        )
    },
})

export default page
export { generateMetadata }
