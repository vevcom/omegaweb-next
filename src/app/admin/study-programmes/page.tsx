import UpdateStudyProgrammeForm from './updateStudyProgrammeForm'
import StudyProgrammeTableBody from './studyProgrammeTable'
import styles from './page.module.scss'
import { studyProgrammeOperations } from '@/services/groups/studyProgrammes/operations'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { studyProgrammeAuth } from '@/services/groups/studyProgrammes/auth'
import { serverPage } from '@/app/serverPage'
import { authorizeAdminPage } from '@/app/admin/authorizeAdminPage'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        authorizeAdminPage('study-programmes', session)
        return studyProgrammeOperations.readMany({})
    },
    capabilities: () => ({
        canCreate: studyProgrammeAuth.create,
        canEdit: studyProgrammeAuth.update,
    }),
    metadata: () => ({ title: 'Studieprogrammer' }),
    render: ({ data: studyprogrammes, capabilities }) => (
        <PageWrapper
            headerItem={
                capabilities.canCreate.authorized && (
                    <AddHeaderItemPopUp popUpKey="CreateStudyProgramme">
                        <UpdateStudyProgrammeForm />
                    </AddHeaderItemPopUp>
                )
            }
        >
            <table className={styles.table}>
                <thead>
                    <tr>
                        {capabilities.canEdit.authorized && <th>Rediger</th>}
                        <th>Navn</th>
                        <th>Kode</th>
                        <th>Institutt kode</th>
                        <th>Startklasse</th>
                        <th>Lengde på studiet</th>
                        <th>Del av Omega</th>
                    </tr>
                </thead>
                <StudyProgrammeTableBody studyprogrammes={studyprogrammes} />
            </table>
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
