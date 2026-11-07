import AddRevueGroupMember from './AddRevueGroupMember'
import RevueGroupMember from './RevueGroupMember'
import RevueGroupSettings from './RevueGroupSettings'
import yearFromParam from '@/app/(revue)/revue/[year]/yearFromParam'
import { revueLinks } from '@/app/(revue)/links'
import {
    addPartToRevueGroupArticleSectionAction,
    removePartFromRevueGroupArticleSectionAction,
    updateRevueGroupArticleSectionAction,
    updateRevueGroupCmsImageAction,
    updateRevueGroupCmsLinkAction,
    updateRevueGroupCmsParagraphAction,
} from '@/services/revue/groups/actions'
import { revueGroupAuth } from '@/services/revue/groups/auth'
import { revueGroupMemberAuth } from '@/services/revue/groups/members/auth'
import { revueGroupOperations } from '@/services/revue/groups/operations'
import { userAuth } from '@/services/users/auth'
import ArticleSection from '@/components/Cms/ArticleSection/ArticleSection'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import SiteLink from '@/components/SiteLink/SiteLink'
import { runCapabilities } from '@/auth/authorizer/capabilities'
import { configureAction } from '@/services/configureAction'
import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params }: PageOperationArgs<{ year: string, name: string }>) => revueGroupOperations.read({
        params: { year: yearFromParam(params.year), name: decodeURIComponent(params.name) },
    }),
    capabilities: () => ({
        canEdit: revueGroupAuth.updateArticleSection,
        canEditMembers: revueGroupMemberAuth.update,
    }),
    metadata: group => ({ title: `${group.name} - ${group.revue.name}` }),
    render: ({ data: group, capabilities, session }) => {
        const actionConfig = { implementationParams: { groupId: group.id } }

        return (
            <PageWrapper>
                <div className="flex justify-between items-center mb-4">
                    <SiteLink href={revueLinks.revue(group.revue)}>{group.revue.name}</SiteLink>
                    <RevueGroupSettings group={group} revue={group.revue} />
                </div>
                <h1>{group.name}</h1>
                <ArticleSection
                    articleSection={group.articleSection}
                    capabilities={{ canEdit: capabilities.canEdit }}
                    actions={{
                        updateArticleSection: configureAction(updateRevueGroupArticleSectionAction, actionConfig),
                        addPartToArticleSection: configureAction(addPartToRevueGroupArticleSectionAction, actionConfig),
                        removePartFromArticleSection: configureAction(
                            removePartFromRevueGroupArticleSectionAction, actionConfig
                        ),
                        updateCmsImage: configureAction(updateRevueGroupCmsImageAction, actionConfig),
                        updateCmsParagraph: configureAction(updateRevueGroupCmsParagraphAction, actionConfig),
                        updateCmsLink: configureAction(updateRevueGroupCmsLinkAction, actionConfig),
                    }}
                />
                <section className="mt-8">
                    <h2>Medlemmer</h2>
                    {group.members.length > 0 ? (
                        <ul className="list-none p-0 mt-2">
                            {group.members.map(member => (
                                <RevueGroupMember
                                    key={member.id}
                                    member={member}
                                    capabilities={{
                                        canEdit: capabilities.canEditMembers,
                                        ...runCapabilities(session, {
                                            canReadProfile: userAuth.readProfile.data({
                                                userField: { id: member.userId ?? undefined },
                                            }),
                                        }),
                                    }}
                                />
                            ))}
                        </ul>
                    ) : <p className="mt-2 text-text-muted">Ingen medlemmer enda</p>}
                    <AddRevueGroupMember groupId={group.id} />
                </section>
            </PageWrapper>
        )
    },
})

export default page
export { generateMetadata }
