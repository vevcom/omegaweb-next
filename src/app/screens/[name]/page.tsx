import styles from './page.module.scss'
import ScreenCarousel from './ScreenCarousel'
import UpdateScreenForm from './UpdateScreenForm'
import ScreenPagesForm from './ScreenPagesForm'
import ScreenPageContent from '@/app/screens/ScreenPageContent'
import { readScreenPageLinkedContent } from '@/app/screens/readScreenPageLinkedContent'
import Form from '@/components/Form/Form'
import { SettingsHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import { destroyScreenAction } from '@/services/screens/actions'
import { screenOperations } from '@/services/screens/operations'
import { screenAuth } from '@/services/screens/auth'
import { screenPageOperations } from '@/services/screens/pages/operations'
import { screenPageAuth } from '@/services/screens/pages/auth'
import { configureAction } from '@/services/configureAction'
import { serverPage, withFallback } from '@/app/serverPage'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ name: string }>) => {
        const screen = await screenOperations.read({ params: { name: decodeURIComponent(params.name) } })
        const linkedContents = await Promise.all(screen.pages.map(readScreenPageLinkedContent))

        // Every page there is feeds the page chooser of those who may change what the screen shows,
        // so it is loaded for no one else.
        const screenPages = screenAuth.updatePages.auth(session).authorized
            ? await withFallback(screenPageOperations.readMany({}), [])
            : []

        return { screen, linkedContents, screenPages }
    },
    capabilities: () => ({
        canUpdate: screenAuth.update,
        canUpdatePages: screenAuth.updatePages,
        canDestroy: screenAuth.destroy,
        canEditCmsImage: screenPageAuth.updateCmsImage,
        canEditCmsParagraph: screenPageAuth.updateCmsParagraphContent,
    }),
    metadata: (data) => ({ title: data.screen.name }),
    render: ({ data: { screen, linkedContents, screenPages }, capabilities }) => (
        <div className={`${styles.screen} ${screen.orientation === 'PORTRAIT' ? 'portrait' : ''}`}>
            {(
                capabilities.canUpdate.authorized ||
                capabilities.canUpdatePages.authorized ||
                capabilities.canDestroy.authorized
            ) && (
                <div className={styles.settings}>
                    <SettingsHeaderItemPopUp scale={30} popUpKey="screenSettings">
                        {capabilities.canUpdate.authorized && <UpdateScreenForm screen={screen} />}
                        {capabilities.canUpdatePages.authorized && (
                            <ScreenPagesForm
                                screenId={screen.id}
                                shownPageIds={screen.pages.map(screenPage => screenPage.id)}
                                screenPages={screenPages}
                            />
                        )}
                        {capabilities.canDestroy.authorized && (
                            <Form
                                action={configureAction(destroyScreenAction, { params: { id: screen.id } })}
                                navigateOnSuccess="/screens"
                                submitText="Slett skjermen"
                                submitColor="red"
                                confirmation={{
                                    confirm: true,
                                    text: 'Er du sikker på at du vil slette skjermen? Sidene blir værende.',
                                }}
                            />
                        )}
                    </SettingsHeaderItemPopUp>
                </div>
            )}
            <ScreenCarousel>
                {screen.pages.map((screenPage, index) => (
                    <ScreenPageContent
                        key={screenPage.id}
                        page={screenPage}
                        linkedContent={linkedContents[index]}
                        capabilities={{
                            canEditCmsImage: capabilities.canEditCmsImage,
                            canEditCmsParagraph: capabilities.canEditCmsParagraph,
                        }}
                    />
                ))}
            </ScreenCarousel>
        </div>
    ),
})

export default page
export { generateMetadata }
