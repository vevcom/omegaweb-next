import InterestGroupSettings from './InterestGroupSettings'
import ArticleSection from '@/components/Cms/ArticleSection/ArticleSection'
import {
    updateInterestGroupArticleSectionAction,
    addPartToInterestGroupArticleSectionAction,
    removePartFromInterestGroupArticleSectionAction,
    updateInterestGroupCmsImageAction,
    updateInterestGroupCmsParagraphAction,
    updateInterestGroupCmsLinkAction
} from '@/services/groups/interestGroups/actions'
import { configureAction } from '@/services/configureAction'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGear } from '@fortawesome/free-solid-svg-icons'
import type { Capabilities } from '@/auth/authorizer/capabilities'
import type { ExpandedInterestGroup } from '@/services/groups/interestGroups/types'

type PropTypes = {
    interestGroup: ExpandedInterestGroup
    capabilities: Capabilities<'canEditArticleSection' | 'canAdministrate'>
}

const administrateClassName = `
    text-accent-blue p-2 size-[30px] ml-auto
    hover:text-[color-mix(in_srgb,var(--accent-blue),black_10%)] hover:cursor-pointer
`

export default function InterestGroup({ interestGroup, capabilities }: PropTypes) {
    const cmsArticleActionConfig = { implementationParams: { interestGroupId: interestGroup.id } }

    return (
        <div className="bg-surface-base rounded-round p-4">
            <div className="
                flex justify-between items-center gap-4
                [&_h2]:text-xl
            ">
                <h2>{interestGroup.name}</h2>
                {interestGroup.group.pensioned && (
                    <span className="px-2 rounded-round border border-text-muted text-text-muted text-s whitespace-nowrap">
                        Pensjonert
                    </span>
                )}
                {capabilities.canAdministrate.authorized && (
                    <Link
                        className={administrateClassName}
                        href={`/interest-groups/${interestGroup.id}`}
                        aria-label={`Administrer ${interestGroup.name}`}
                    >
                        <FontAwesomeIcon icon={faGear} />
                    </Link>
                )}
                <InterestGroupSettings
                    interestGroupId={interestGroup.id}
                    interestGroupName={interestGroup.name}
                    groupId={interestGroup.groupId}
                    pensioned={interestGroup.group.pensioned}
                />
            </div>
            <ArticleSection
                capabilities={{ canEdit: capabilities.canEditArticleSection }}
                key={interestGroup.id}
                articleSection={interestGroup.articleSection}
                actions={{
                    updateArticleSection: configureAction(
                        updateInterestGroupArticleSectionAction, cmsArticleActionConfig
                    ),
                    addPartToArticleSection: configureAction(
                        addPartToInterestGroupArticleSectionAction, cmsArticleActionConfig
                    ),
                    removePartFromArticleSection: configureAction(
                        removePartFromInterestGroupArticleSectionAction, cmsArticleActionConfig
                    ),
                    updateCmsImage: configureAction(
                        updateInterestGroupCmsImageAction, cmsArticleActionConfig
                    ),
                    updateCmsParagraph: configureAction(
                        updateInterestGroupCmsParagraphAction, cmsArticleActionConfig
                    ),
                    updateCmsLink: configureAction(
                        updateInterestGroupCmsLinkAction, cmsArticleActionConfig
                    ),
                }}
            />
        </div>
    )
}
