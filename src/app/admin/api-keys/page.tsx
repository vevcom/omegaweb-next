import styles from './page.module.scss'
import CreateApiKeyForm from './CreateApiKeyForm'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import { apiKeyOperations } from '@/services/apiKeys/operations'
import { serverPage } from '@/app/serverPage'
import Date from '@/components/Date/Date'
import { authorizeAdminPage } from '@/app/admin/authorizeAdminPage'
import Link from 'next/link'
import type { PageOperationArgs } from '@/app/serverPage'

const popUpKey = 'createApiKey'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        authorizeAdminPage('api-keys', session)
        return apiKeyOperations.readMany({})
    },
    metadata: () => ({ title: 'API-nøkler' }),
    render: ({ data: apiKeys }) => (
        <PageWrapper headerItem={
            <AddHeaderItemPopUp popUpKey={popUpKey}>
                <CreateApiKeyForm popUpKey={popUpKey} />
            </AddHeaderItemPopUp>
        }>
            <div className={styles.wrapper}>
                <table className={styles.ApiKeysList}>
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
                            <Link href={`/admin/api-keys/${apiKey.name}`} key={apiKey.id} passHref>
                                <tr className={apiKey.active ? styles.activated : styles.deactivated}>
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
