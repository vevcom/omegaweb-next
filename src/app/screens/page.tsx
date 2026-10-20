import styles from './page.module.scss'
import { createScreenAction } from '@/services/screens/actions'
import { screenOperations } from '@/services/screens/operations'
import { screenAuth } from '@/services/screens/auth'
import { screenOrientationLabels } from '@/services/screens/constants'
import { createScreenPageAction } from '@/services/screens/pages/actions'
import { screenPageOperations } from '@/services/screens/pages/operations'
import { screenPageAuth } from '@/services/screens/pages/auth'
import { screenPageTypeLabels } from '@/services/screens/pages/constants'
import Form from '@/components/Form/Form'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import SimpleTable from '@/components/Table/SimpleTable'
import TextInput from '@/components/UI/TextInput'
import { SelectString } from '@/components/UI/Select'
import { serverPage, withFallback } from '@/app/serverPage'
import { ScreenOrientation } from '@/prisma-generated-pn-types'

const { page, generateMetadata } = serverPage({
    operation: async () => {
        const [screens, screenPages] = await Promise.all([
            screenOperations.readMany({}),
            withFallback(screenPageOperations.readMany({}), []),
        ])
        return { screens, screenPages }
    },
    capabilities: () => ({
        canCreateScreen: screenAuth.create,
        canCreatePage: screenPageAuth.create,
    }),
    metadata: () => ({ title: 'Skjermer' }),
    render: ({ data: { screens, screenPages }, capabilities }) => (
        <PageWrapper headerItem={
            <div className={styles.head}>
                {capabilities.canCreateScreen.authorized && (
                    <AddHeaderItemPopUp popUpKey="createScreen" label="Skjerm">
                        <Form
                            title="Ny skjerm"
                            action={createScreenAction}
                            submitText="Lag"
                            refreshOnSuccess
                            closePopUpOnSuccess="createScreen"
                        >
                            <TextInput name="name" label="Navn" />
                            <SelectString
                                name="orientation"
                                label="Retning"
                                defaultValue={ScreenOrientation.LANDSCAPE}
                                options={Object.values(ScreenOrientation).map(orientation => ({
                                    value: orientation,
                                    label: screenOrientationLabels[orientation],
                                }))}
                            />
                        </Form>
                    </AddHeaderItemPopUp>
                )}
                {capabilities.canCreatePage.authorized && (
                    <AddHeaderItemPopUp popUpKey="createScreenPage" label="Side">
                        <Form
                            title="Ny side"
                            action={createScreenPageAction}
                            submitText="Lag"
                            refreshOnSuccess
                            closePopUpOnSuccess="createScreenPage"
                        >
                            <TextInput name="name" label="Navn" />
                        </Form>
                    </AddHeaderItemPopUp>
                )}
            </div>
        }>
            <h2>Skjermer</h2>
            {screens.length === 0 ? <p>Ingen skjermer ennå.</p> : (
                <SimpleTable
                    header={['Navn', 'Retning', 'Sider']}
                    body={screens.map(screen => [
                        screen.name,
                        screenOrientationLabels[screen.orientation],
                        screen._count.pages,
                    ])}
                    links={screens.map(screen => `/screens/${encodeURIComponent(screen.name)}`)}
                />
            )}
            <h2>Sider</h2>
            {screenPages.length === 0 ? <p>Ingen sider ennå.</p> : (
                <SimpleTable
                    header={['Navn', 'Type']}
                    body={screenPages.map(screenPage => [screenPage.name, screenPageTypeLabels[screenPage.type]])}
                    links={screenPages.map(screenPage => `/screens/pages/${screenPage.id}`)}
                />
            )}
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
