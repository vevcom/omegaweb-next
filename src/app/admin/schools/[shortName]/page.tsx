import styles from './page.module.scss'
import UpdateSchool from './UpdateSchool'
import PageTitleSetter from '@/contexts/PageTitleSetter'
import { destroySchoolAction, readSchoolAction } from '@/education/schools/actions'
import Form from '@/components/Form/Form'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import School from '@/components/School/School'
import { configureAction } from '@/services/configureAction'

type PropTypes = {
    params: Promise<{
        shortName: string
    }>
}

export default async function SchoolAdmin({ params }: PropTypes) {
    const shortName = decodeURIComponent((await params).shortName)

    const res = await readSchoolAction({ params: { shortName } })
    if (!res.success) throw new Error(res.error?.length ? res.error[0].message : 'Unknown error')
    const school = res.data

    return (
        <PageWrapper>
            <PageTitleSetter title="Administrer skole" />
            <UpdateSchool school={school} />
            <div className={styles.preview}>
                <School school={school} />
            </div>
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
        </PageWrapper>
    )
}
