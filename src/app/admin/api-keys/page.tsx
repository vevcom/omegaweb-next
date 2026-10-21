import CreateApiKeyForm from './CreateApiKeyForm'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import { apiKeyOperations } from '@/services/apiKeys/operations'
import { apiKeyAuth } from '@/services/apiKeys/auth'
import { serverPage } from '@/app/ServerPage'
import Date from '@/components/Date/Date'
import { authorizeAdminPage } from '@/app/admin/authorizeAdminPage'
import Link from 'next/link'
import type { PageOperationArgs } from '@/app/ServerPage'

const popUpKey = 'createApiKey'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        authorizeAdminPage('api-keys', session)
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
                            <Link
                                href={`/admin/api-keys/${apiKey.name}`}
                                key={apiKey.id}
                                passHref
                                className="contents no-underline text-inherit"
                            >
                                <tr
                                    className={apiKey.active
                                        ? 'bg-[color-mix(in_srgb,var(--accent-green),white_50%)] text-accent-green'
                                        : 'bg-[color-mix(in_srgb,var(--accent-red),white_50%)] text-accent-red'}
                                >
                                    <td>{apiKey.name}</td>
                                    <td><Date date={apiKey.createdAt} /></td>
                                    <td><Date date={apiKey.updatedAt} /></td>
                                    <td>{apiKey.expiresAt ? <Date date={apiKey.expiresAt} /> : 'Ikke satt'}</td>
                                    <td>{apiKey.active ? 'AKTIV' : 'INAKTIV'}</td>
                                </tr>
                            </Link>
                        ))}
                    </tbody>
                </table>
            </div>
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
