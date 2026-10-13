import styles from './page.module.scss'
import UpdateSchool from './UpdateSchool'
import { destroySchoolAction } from '@/education/schools/actions'
import { schoolOperations } from '@/education/schools/operations'
import { schoolAuth } from '@/education/schools/auth'
import Form from '@/components/Form/Form'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import School from '@/components/School/School'
import { configureAction } from '@/services/configureAction'
import { serverPage } from '@/app/serverPage'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params }: PageOperationArgs<{ shortName: string }>) =>
        schoolOperations.read({ params: { shortName: decodeURIComponent(params.shortName) } }),
    capabilities: () => ({
        canUpdateSchool: schoolAuth.update,
        canDestroySchool: schoolAuth.destroy,
    }),
    metadata: () => ({ title: 'Administrer skole' }),
    render: ({ data: school, capabilities }) => (
        <PageWrapper>
            {capabilities.canUpdateSchool.authorized && <UpdateSchool school={school} />}
            <div className={styles.preview}>
                <School school={school} />
            </div>
            {capabilities.canDestroySchool.authorized &&
            <Form
                action={configureAction(destroySchoolAction, { params: { id: school.id } })}
                navigateOnSuccess="/admin/schools"
                refreshOnSuccess
                submitText="Slett"
                submitColor="red"
                confirmation={{
                    confirm: true,
                    text: 'Er du sikker på at du vil slette denne skolen? De vil også slette alle emner til denne skolen.'
                }}
            />
            }
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
