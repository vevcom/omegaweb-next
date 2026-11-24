import ManageRevueSubGroupMembers from './ManageRevueSubGroupMembers'
import RevueGroupSettings from './RevueGroupSettings'
import yearFromParam from '@/app/(revue)/revue/[year]/yearFromParam'
import { revueLinks } from '@/app/(revue)/links'
import { omegaLinks } from '@/app/(omegaweb)/links'
import {
    addPartToRevueGroupArticleSectionAction,
    removePartFromRevueGroupArticleSectionAction,
    updateRevueGroupArticleSectionAction,
    updateRevueGroupCmsImageAction,
    updateRevueGroupCmsLinkAction,
    updateRevueGroupCmsParagraphAction,
} from '@/services/revue/groups/actions'
import { revueGroupAuth } from '@/services/revue/groups/auth'
import { revueGroupOperations } from '@/services/revue/groups/operations'
import { revueSubGroupOperations } from '@/services/groups/revueSubGroups/operations'
import { groupTypesConfig } from '@/services/groups/constants'
import ArticleSection from '@/components/Cms/ArticleSection/ArticleSection'
import { groupMembersByOrder } from '@/components/Group/groupMembersByOrder'
import SiteLink from '@/components/SiteLink/SiteLink'
import { configureAction } from '@/services/configureAction'
import { serverPage, withFallback } from '@/app/ServerPage'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faArrowRight } from '@fortawesome/free-solid-svg-icons'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params }: PageOperationArgs<{ year: string, name: string }>) => {
        const group = await revueGroupOperations.readInRevue({
            params: { year: yearFromParam(params.year), name: decodeURIComponent(params.name) },
        })
        // Every membership of every order, for those who manage the sub group's members in the revue it stands in.
        const memberships = group.type === 'REVUE_SUB_GROUP' && group.order === group.group.order
            ? await withFallback(
                revueSubGroupOperations.readMembers({ params: { groupId: group.group.id } }),
                null,
                ['UNAUTHENTICATED', 'UNAUTHORIZED'],
            )
            : null
        return { group, memberships }
    },
    capabilities: ({ group }) => ({
        canEdit: revueGroupAuth.updateArticleSection.data({ groupId: group.group.id }),
    }),
    metadata: ({ group }) => ({ title: `${group.name} - ${group.revue.name}` }),
    render: ({ data: { group, memberships }, capabilities }) => {
        const actionConfig = { implementationParams: { revueGroupId: group.id } }

        return (
            <div className="flex flex-col gap-8">
                <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                        <SiteLink href={revueLinks.revue(group.revue)} className="
                            inline-flex items-center gap-2 text-m
                            [&_svg]:size-[0.85em]!
                        ">
                            <FontAwesomeIcon icon={faArrowLeft} />
                            {group.revue.name}
                        </SiteLink>
                        <RevueGroupSettings group={group} revue={group.revue} />
                    </div>
                    <header className="
                        flex flex-col items-start gap-3 p-[clamp(1.25rem,5vw,2.5rem)] rounded-round border-l-4
                        border-accent bg-base-200
                    ">
                        <span className="text-s font-semibold tracking-[0.2em] uppercase text-base-content/80">
                            {groupTypesConfig[group.type].name} · {group.revue.year}
                        </span>
                        <h1 className="
                            font-secondary text-[clamp(2.25rem,7vw,4rem)] font-bold leading-[1.05] text-balance
                            wrap-anywhere
                        ">
                            {group.name}
                        </h1>
                        {group.committee && (
                            <SiteLink
                                href={omegaLinks.committee(group.committee)}
                                toMainDomainServingSite
                                className="
                                    inline-flex items-center gap-2 text-m
                                    [&_svg]:size-[0.85em]!
                                "
                            >
                                {group.committee.name} på Omegaveven
                                <FontAwesomeIcon icon={faArrowRight} />
                            </SiteLink>
                        )}
                    </header>
                </div>
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
                <section className="flex flex-col gap-6">
                    <h2 className="font-secondary text-xl">Medlemmer</h2>
                    {group.members.length > 0 ? (
                        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(13rem,100%),1fr))] gap-4 list-none">
                            {group.members.map((member, index) => (
                                <li key={index} className="flex flex-col gap-1 p-4 rounded-round bg-base-200">
                                    <span className="font-semibold wrap-anywhere">{member.name}</span>
                                    <span className="text-s text-base-content/80">{member.title}</span>
                                </li>
                            ))}
                        </ul>
                    ) : <p className="text-base-content/80">Ingen medlemmer i {group.revue.name}.</p>}
                </section>
                {memberships && (
                    <ManageRevueSubGroupMembers
                        groupId={group.group.id}
                        groupOrder={group.group.order}
                        orders={groupMembersByOrder(memberships, group.group.order)}
                    />
                )}
            </div>
        )
    },
})

export default page
export { generateMetadata }
