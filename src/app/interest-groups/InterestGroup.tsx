import styles from './InterestGroup.module.scss'
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

export default function InterestGroup({ interestGroup, capabilities }: PropTypes) {
    const cmsArticleActionConfig = { implementationParams: { interestGroupId: interestGroup.id } }

    return (
        <div className={styles.interestGroup}>
            <div className={styles.title}>
                <h2>{interestGroup.name}</h2>
                {interestGroup.pensioned && <span className={styles.pensioned}>Pensjonert</span>}
                {capabilities.canAdministrate.authorized && (
                    <Link
                        className={styles.administrate}
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
