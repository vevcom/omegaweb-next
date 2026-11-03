import UpdateApiKeyForm from './UpdateApiKeyForm'
import { destroyApiKeyAction } from '@/services/apiKeys/actions'
import { apiKeyOperations } from '@/services/apiKeys/operations'
import { apiKeyAuth } from '@/services/apiKeys/auth'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import Form from '@/components/Form/Form'
import DateInput from '@/components/UI/DateInput'
import TextInput from '@/components/UI/TextInput'
import DisplayAllPermissions from '@/components/Permission/DisplayAllPermissions'
import Slider from '@/components/UI/Slider'
import Date from '@/app/_components/Date/Date'
import Checkbox from '@/app/_components/UI/Checkbox'
import { configureAction } from '@/services/configureAction'
import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params }: PageOperationArgs<{ name: string }>) =>
        apiKeyOperations.read({ params: { name: decodeURIComponent(params.name) } }),
    capabilities: () => ({
        canUpdateApiKey: apiKeyAuth.update,
        canDestroyApiKey: apiKeyAuth.destroy,
    }),
    metadata: () => ({ title: 'API-nøkkel' }),
    render: ({ data: apiKey, capabilities }) => (
        <PageWrapper>
            <div>
                <h2>Navn: {apiKey.name}</h2>
                <i>{apiKey.active ? 'Denne API-nøkkelen er aktiv' : 'Denne API-nøkkelen er inaktiv'}</i>
                <div className="mt-[2em]">
                    <p>Utløper: {apiKey.expiresAt ? <Date date={apiKey.expiresAt} /> : 'aldri'}</p>
                    <p>Opprettet: <Date date={apiKey.createdAt} /></p>
                    <p>Sist oppdatert: <Date date={apiKey.updatedAt} /></p>
                </div>

                <div className="mt-[1em] pt-[1em] border-t-[.3em] border-surface-subtle">
                    <h2>Endre nøkkelen</h2>
                    {capabilities.canUpdateApiKey.authorized &&
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
                    }
                    {capabilities.canDestroyApiKey.authorized &&
                    <Form
                        submitText="Slett nøkkel"
                        action={configureAction(destroyApiKeyAction, { params: { id: apiKey.id } })}
                        confirmation={{
                            text: 'Er du sikker på at du vil slette denne nøkkelen? ' +
                                'Vi anbefaler heller å deaktivere den.',
                            confirm: true,
                        }}
                        submitColor="red"
                        navigateOnSuccess="/admin/api-keys"
                    />
                    }
                </div>
            </div>
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
