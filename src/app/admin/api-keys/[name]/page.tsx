import styles from './page.module.scss'
import UpdateApiKeyForm from './UpdateApiKeyForm'
import { destroyApiKeyAction } from '@/services/apiKeys/actions'
import { apiKeyOperations } from '@/services/apiKeys/operations'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import Form from '@/components/Form/Form'
import DateInput from '@/components/UI/DateInput'
import TextInput from '@/components/UI/TextInput'
import DisplayAllPermissions from '@/components/Permission/DisplayAllPermissions'
import Slider from '@/components/UI/Slider'
import Date from '@/app/_components/Date/Date'
import Checkbox from '@/app/_components/UI/Checkbox'
import { configureAction } from '@/services/configureAction'
import { serverPage } from '@/app/serverPage'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params }: PageOperationArgs<{ name: string }>) =>
        apiKeyOperations.read({ params: { name: decodeURIComponent(params.name) } }),
    metadata: () => ({ title: 'API nøkkel' }),
    render: ({ data: apiKey }) => (
        <PageWrapper>
            <div className={styles.wrapper}>
                <h2>Navn: {apiKey.name}</h2>
                <i>{apiKey.active ? 'Denne api nøkkelen er aktiv' : 'Denne api nøkkelen er inaktiv'}</i>
                <div className={styles.dates}>
                    <p>Utgår: {apiKey.expiresAt ? <Date date={apiKey.expiresAt} /> : 'ingen utløp'}</p>
                    <p>Opprettet: <Date date={apiKey.createdAt} /></p>
                    <p>Sist oppdatert: <Date date={apiKey.updatedAt} /></p>
                </div>

                <div className={styles.admin}>
                    <h2>Endre på nøkkel</h2>
                    <UpdateApiKeyForm id={apiKey.id}>
                        <TextInput name="name" label="Navn" defaultValue={apiKey.name} />
                        <Slider label="Aktiv" name="active" defaultChecked={apiKey.active} />
                        <DateInput
                            includeTime
                            name="expiresAt"
                            label="Utløpsdato"
                            defaultValue={apiKey.expiresAt ?? undefined}
                        />
                        <DisplayAllPermissions renderBesidePermission={permission => (
                            <Checkbox
                                name="permissions"
                                value={permission}
                                defaultChecked={apiKey.permissions.includes(permission)}
                            />
                        )}
                        />
                    </UpdateApiKeyForm>
                    <Form
                        submitText="Slett nøkkel"
                        action={configureAction(destroyApiKeyAction, { params: { id: apiKey.id } })}
                        confirmation={{
                            text: 'Er du sikker på at du vil slette denne nøkkelen? ' +
                                'Heller anbefaler vi å deaktivere den.',
                            confirm: true,
                        }}
                        submitColor="red"
                        navigateOnSuccess="/admin/api-keys"
                    />
                </div>
            </div>
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
