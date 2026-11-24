import CreateRevueGroup from './CreateRevueGroup'
import RevueSettings from './RevueSettings'
import { getRevue } from './getRevue'
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
import { revueGroupAuth } from '@/services/revue/groups/auth'
import { revueGroupOperations } from '@/services/revue/groups/operations'
import { omegaOrderOperations } from '@/services/omegaOrder/operations'
import { groupTypesConfig } from '@/services/groups/constants'
import RevueCover from '@/app/(revue)/_components/RevueCover'
import Article from '@/components/Cms/Article/Article'
import ChangeName from '@/components/Cms/Article/ChangeName'
import CmsImageEditor from '@/components/Cms/CmsImage/CmsImageEditor'
import SiteLink from '@/components/SiteLink/SiteLink'
import { configureAction } from '@/services/configureAction'
import { capabilitiesToJsObject } from '@/auth/authorizer/capabilities'
import { serverPage, withFallback } from '@/app/ServerPage'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faArrowRight } from '@fortawesome/free-solid-svg-icons'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params }: PageOperationArgs<{ year: string }>) => {
        const revue = await getRevue(params.year)
        const [groups, allGroups] = await Promise.all([
            revueGroupOperations.readManyInRevue({ params: { revueId: revue.id } }),
            withFallback(revueGroupOperations.readMany({}), null, ['UNAUTHENTICATED', 'UNAUTHORIZED']),
        ])
        const groupSettings = allGroups && {
            groupsInRevue: groups,
            groupsNotInRevue: allGroups
                .filter(group => !groups.some(inRevue => inRevue.id === group.id))
                .map(group => ({ id: group.id, name: group.name })),
            currentOrder: (await withFallback(
                omegaOrderOperations.readCurrent({}),
                null,
                ['UNAUTHENTICATED', 'UNAUTHORIZED'],
            ))?.order ?? null,
        }
        return { revue, groups, groupSettings }
    },
    capabilities: () => ({
        canEdit: revueAuth.updateArticle,
        canCreateGroup: revueGroupAuth.create,
    }),
    metadata: ({ revue }) => ({ title: revue.name }),
    render: ({ data: { revue, groups, groupSettings }, capabilities }) => {
        const actionConfig = { implementationParams: { revueId: revue.id } }
        const clientCapabilities = capabilitiesToJsObject({ canEdit: capabilities.canEdit })

        return (
            <div className="flex flex-col gap-8">
                <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                        <SiteLink href={revueLinks.frontpage()} className="
                            inline-flex items-center gap-2 text-m
                            [&_svg]:size-[0.85em]!
                        ">
                            <FontAwesomeIcon icon={faArrowLeft} />
                            Alle revyer
                        </SiteLink>
                        <RevueSettings revue={revue} groups={groupSettings} />
                    </div>
                    <RevueCover
                        image={revue.article.coverImage.image}
                        year={revue.year}
                        imageWidth={1100}
                        className="min-h-[clamp(18rem,45vw,26rem)]"
                        editor={
                            <CmsImageEditor
                                cmsImage={revue.article.coverImage}
                                updateCmsImageAction={configureAction(updateRevueArticleCoverImageAction, actionConfig)}
                                capabilities={clientCapabilities}
                            />
                        }
                    >
                        <div className="
                            [&_h1]:text-[clamp(2.25rem,7cqw,4.5rem)] [&_h1]:font-bold [&_h1]:leading-[1.05]
                            [&_h1]:text-balance [&_h1]:text-inherit [&_h1]:normal-case
                        ">
                            <ChangeName
                                article={revue.article}
                                updateArticleAction={configureAction(
                                    configureAction(updateRevueArticleAction, actionConfig),
                                    { params: { articleId: revue.article.id } },
                                )}
                                capabilities={clientCapabilities}
                            />
                        </div>
                    </RevueCover>
                </div>
                <Article
                    article={revue.article}
                    hideCoverImage
                    emptyTextOnlyInEditMode
                    articleClassName="empty:hidden"
                    capabilities={{ canEdit: capabilities.canEdit }}
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
                {(groups.length > 0 || capabilities.canCreateGroup.authorized) && (
                    <section className="flex flex-col gap-6">
                        <h2 className="font-secondary text-xl">Grupper</h2>
                        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(15rem,100%),1fr))] gap-4 list-none">
                            {groups.map(group => (
                                <li key={group.id}>
                                    <SiteLink
                                        href={revueLinks.revueGroup(revue, group)}
                                        className="
                                            group flex items-center gap-4 h-full p-5 rounded-round border-l-4
                                            border-accent bg-base-200 text-base-content no-underline transition-colors
                                            hover:bg-base-300 hover:no-underline
                                            focus-visible:outline-2 focus-visible:outline-offset-2
                                            focus-visible:outline-accent
                                        "
                                    >
                                        <span className="flex-1 min-w-0">
                                            <span className="block font-secondary text-l font-bold wrap-anywhere">
                                                {group.name}
                                            </span>
                                            <span className="block text-s text-base-content/80">
                                                {groupTypesConfig[group.type].name} · {memberCount(group.memberCount)}
                                            </span>
                                        </span>
                                        <FontAwesomeIcon icon={faArrowRight} className="
                                            size-[1em]! text-primary transition-transform
                                            group-hover:translate-x-1
                                        " />
                                    </SiteLink>
                                </li>
                            ))}
                            <li className="empty:hidden">
                                <CreateRevueGroup revue={revue} />
                            </li>
                        </ul>
                    </section>
                )}
            </div>
        )
    },
})

export default page
export { generateMetadata }

function memberCount(count: number) {
    if (count === 0) return 'Ingen medlemmer'
    return count === 1 ? '1 medlem' : `${count} medlemmer`
}
