import styles from './ScreenPageContent.module.scss'
import CmsImage from '@/components/Cms/CmsImage/CmsImage'
import CmsParagraph from '@/components/Cms/CmsParagraph/CmsParagraph'
import Date from '@/components/Date/Date'
import { configureAction } from '@/services/configureAction'
import {
    updateScreenPageCmsImageAction,
    updateScreenPageCmsParagraphContentAction,
} from '@/services/screens/pages/actions'
import type { ScreenPageLinkedContent } from './readScreenPageLinkedContent'
import type { ExpandedScreenPage } from '@/services/screens/pages/types'
import type { Capabilities } from '@/auth/authorizer/capabilities'

/**
 * One page as a screen shows it: its image, and for every type but IMAGE its paragraph and what it
 * links to.
 */
export default function ScreenPageContent({ page, linkedContent, capabilities }: {
    page: ExpandedScreenPage,
    linkedContent: ScreenPageLinkedContent,
    capabilities: Capabilities<'canEditCmsImage' | 'canEditCmsParagraph'>,
}) {
    const { jobAd, event, upcomingEvents } = linkedContent

    return (
        <article className={`${styles.ScreenPageContent} ${page.type === 'IMAGE' ? styles.imageOnly : ''}`}>
            <CmsImage
                className={styles.image}
                cmsImage={page.cmsImage}
                width={1200}
                capabilities={{ canEdit: capabilities.canEditCmsImage }}
                updateCmsImageAction={configureAction(
                    updateScreenPageCmsImageAction,
                    { implementationParams: { screenPageId: page.id } },
                )}
            />
            {page.type !== 'IMAGE' && (
                <div className={styles.text}>
                    {jobAd && (
                        <section>
                            <h2>{jobAd.articleName}</h2>
                            <p className={styles.subtitle}>{jobAd.company.name}</p>
                            {jobAd.description && <p>{jobAd.description}</p>}
                        </section>
                    )}
                    {event && (
                        <section>
                            <h2>{event.name}</h2>
                            <p className={styles.subtitle}>
                                <Date date={event.eventStart} />{event.location && `, ${event.location}`}
                            </p>
                        </section>
                    )}
                    {page.type === 'EVENT_TAG' && page.eventTag && (
                        <section>
                            <h2>Kommende: {page.eventTag.name}</h2>
                            {upcomingEvents.length === 0 ? <p>Ingen kommende arrangementer.</p> : (
                                <ul className={styles.events}>
                                    {upcomingEvents.map(upcomingEvent => (
                                        <li key={upcomingEvent.id}>
                                            <Date date={upcomingEvent.eventStart} /> {upcomingEvent.name}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    )}
                    <CmsParagraph
                        cmsParagraph={page.cmsParagraph}
                        capabilities={{ canEdit: capabilities.canEditCmsParagraph }}
                        updateCmsParagraphAction={configureAction(
                            updateScreenPageCmsParagraphContentAction,
                            { implementationParams: { screenPageId: page.id } },
                        )}
                    />
                </div>
            )}
        </article>
    )
}
