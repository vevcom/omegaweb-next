import styles from './page.module.scss'
import { SchoolAdminList } from './SchoolAdminList'
import Form from '@/components/Form/Form'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { createSchoolAction } from '@/education/schools/actions'
import { schoolOperations } from '@/education/schools/operations'
import TextInput from '@/components/UI/TextInput'
import { authorizeAdminPage } from '@/app/admin/authorizeAdminPage'
import { serverPage } from '@/app/serverPage'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        authorizeAdminPage('schools', session)
        const [standardSchools, schools] = await Promise.all([
            schoolOperations.readStandard({}),
            schoolOperations.readMany({ params: { onlyNonStandard: true } }),
        ])
        return { standardSchools, schools }
    },
    metadata: () => ({ title: 'Skoler' }),
    render: ({ data: { standardSchools, schools } }) => (
        <PageWrapper headerItem={
            <AddHeaderItemPopUp popUpKey="CreateSchool">
                <Form
                    action={createSchoolAction}
                    refreshOnSuccess
                >
                    <TextInput label="Navn" name="name" />
                    <TextInput label="Kortnavn" name="shortName" />
                </Form>
            </AddHeaderItemPopUp>
        }>
            <div className={styles.wrapper}>
                <p>Skoler er brukt på fagveven</p>
                <h2>Standard Skoler</h2>
                <SchoolAdminList schools={standardSchools} />
                <h2>Andre Skoler</h2>
                <SchoolAdminList schools={schools} />
            </div>
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
