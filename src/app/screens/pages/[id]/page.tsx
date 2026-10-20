import styles from './page.module.scss'
import UpdateScreenPageForm from './UpdateScreenPageForm'
import ScreenPageContent from '@/app/screens/ScreenPageContent'
import { readScreenPageLinkedContent } from '@/app/screens/readScreenPageLinkedContent'
import Form from '@/components/Form/Form'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { SettingsHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import { destroyScreenPageAction } from '@/services/screens/pages/actions'
import { screenPageOperations } from '@/services/screens/pages/operations'
import { screenPageAuth } from '@/services/screens/pages/auth'
import { screenPageTypeLabels } from '@/services/screens/pages/constants'
import { jobAdOperations } from '@/services/career/jobAds/operations'
import { eventOperations } from '@/services/events/operations'
import { eventTagOperations } from '@/services/events/tags/operations'
import { configureAction } from '@/services/configureAction'
import { serverPage, withFallback } from '@/app/serverPage'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ id: string }>) => {
        const screenPage = await screenPageOperations.read({ params: { id: parseInt(params.id, 10) } })
        const linkedContent = await readScreenPageLinkedContent(screenPage)

        // What a page can link to feeds the settings of those who may change it, so it is loaded for
        // no one else, each through its own service and falling back to nothing to choose.
        const [jobAds, events, eventTags] = screenPageAuth.update.auth(session).authorized
            ? await Promise.all([
                withFallback(jobAdOperations.readActive({}), []),
                withFallback(eventOperations.readManyCurrent({ params: { tags: null } }), []),
                withFallback(eventTagOperations.readAll({}), []),
            ])
            : [[], [], []]

        return {
            screenPage,
            linkedContent,
            jobAds: jobAds.map(jobAd => ({ value: jobAd.id, label: `${jobAd.articleName} (${jobAd.companyName})` })),
            events: events.map(event => ({ value: event.id, label: event.name })),
            eventTags: eventTags.map(eventTag => ({ value: eventTag.id, label: eventTag.name })),
        }
    },
    capabilities: () => ({
        canUpdate: screenPageAuth.update,
        canDestroy: screenPageAuth.destroy,
        canEditCmsImage: screenPageAuth.updateCmsImage,
        canEditCmsParagraph: screenPageAuth.updateCmsParagraphContent,
    }),
    metadata: (data) => ({ title: data.screenPage.name }),
    render: ({ data: { screenPage, linkedContent, jobAds, events, eventTags }, capabilities }) => (
        <PageWrapper headerItem={(capabilities.canUpdate.authorized || capabilities.canDestroy.authorized) && (
            <SettingsHeaderItemPopUp scale={30} popUpKey="screenPageSettings">
                {capabilities.canUpdate.authorized && (
                    <UpdateScreenPageForm screenPage={screenPage} jobAds={jobAds} events={events} eventTags={eventTags} />
                )}
                {capabilities.canDestroy.authorized && (
                    <Form
                        action={configureAction(destroyScreenPageAction, { params: { id: screenPage.id } })}
                        navigateOnSuccess="/screens"
                        submitText="Slett siden"
                        submitColor="red"
                        confirmation={{
                            confirm: true,
                            text: 'Er du sikker på at du vil slette siden? Den forsvinner fra alle skjermer.',
                        }}
                    />
                )}
            </SettingsHeaderItemPopUp>
        )}>
            <p>{screenPageTypeLabels[screenPage.type]}</p>
            <div className={styles.preview}>
                <ScreenPageContent
                    page={screenPage}
                    linkedContent={linkedContent}
                    capabilities={{
                        canEditCmsImage: capabilities.canEditCmsImage,
                        canEditCmsParagraph: capabilities.canEditCmsParagraph,
                    }}
                />
            </div>
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
