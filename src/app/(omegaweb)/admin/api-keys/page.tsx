import CreateApiKeyForm from './CreateApiKeyForm'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import { apiKeyOperations } from '@/services/apiKeys/operations'
import { apiKeyAuth } from '@/services/apiKeys/auth'
import { serverPage } from '@/app/ServerPage'
import Date from '@/components/Date/Date'
import { authorizeAdminPage } from '@/app/(omegaweb)/admin/authorizeAdminPage'
import RowLink from '@/components/Table/RowLink'
import { appHref } from '@/lib/sites/href'
import type { PageOperationArgs } from '@/app/ServerPage'

const popUpKey = 'createApiKey'
const activeKeyClass = 'bg-[color-mix(in_srgb,var(--color-success),white_50%)] text-success'
const inactiveKeyClass = 'bg-[color-mix(in_srgb,var(--color-error),white_50%)] text-error'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        await authorizeAdminPage('api-keys', session)
        return apiKeyOperations.readMany({})
    },
    capabilities: () => ({
        canCreateApiKey: apiKeyAuth.create,
    }),
    metadata: () => ({ title: 'API-nøkler' }),
    render: ({ data: apiKeys, capabilities }) => (
        <PageWrapper headerItem={capabilities.canCreateApiKey.authorized &&
            <AddHeaderItemPopUp popUpKey={popUpKey}>
                <CreateApiKeyForm popUpKey={popUpKey} />
            </AddHeaderItemPopUp>
        }>
            <div className="max-mobile:max-w-[80vw] max-mobile:overflow-y-scroll">
                <table className="ohma-table">
                    <thead>
                        <tr>
                            <th>Navn</th>
                            <th>Opprettet</th>
                            <th>Sist oppdatert</th>
                            <th>Utløper</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {apiKeys.map(apiKey => (
                            <tr
                                key={apiKey.id}
                                className={`
                                    relative
                                    ${apiKey.active ? activeKeyClass : inactiveKeyClass}
                                `}
                            >
                                <td><RowLink href={appHref(`/admin/api-keys/${apiKey.name}`)}>{apiKey.name}</RowLink></td>
                                <td><Date date={apiKey.createdAt} /></td>
                                <td><Date date={apiKey.updatedAt} /></td>
                                <td>{apiKey.expiresAt ? <Date date={apiKey.expiresAt} /> : 'Ikke satt'}</td>
                                <td>{apiKey.active ? 'AKTIV' : 'INAKTIV'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
