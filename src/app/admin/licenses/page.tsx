import styles from './page.module.scss'
import { SettingsHeaderItemPopUp } from '@/app/_components/HeaderItems/HeaderItemPopUp'
import Form from '@/app/_components/Form/Form'
import {
    destroyLicenseAction,
    createLicenseAction,
    updateLicenseAction,
} from '@/services/licenses/actions'
import { licenseOperations } from '@/services/licenses/operations'
import { serverPage } from '@/app/serverPage'
import TextInput from '@/UI/TextInput'
import { configureAction } from '@/services/configureAction'
import { authorizeAdminPage } from '@/app/admin/authorizeAdminPage'
import Link from 'next/link'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        authorizeAdminPage('licenses', session)
        return licenseOperations.readAll({})
    },
    metadata: () => ({ title: 'Lisenser' }),
    render: ({ data: licenses }) => (
        <div className={styles.wrapper}>
            <h1>Lisenser</h1>
            <p>Lisenser brukes for bilder</p>
            <table className={styles.licenses}>
                <thead>
                    <tr>
                        <th>id</th>
                        <th>Navn</th>
                        <th>Link</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {licenses.map((license) => (
                        <tr key={license.id}>
                            <td>{license.id}</td>
                            <td>{license.name}</td>
                            <td>
                                <Link href={license.link}>
                                    Til lisens
                                </Link>
                            </td>
                            <td>
                                <SettingsHeaderItemPopUp popUpKey={`LicenseSettings ${license.id}`}>
                                    <Form
                                        action={configureAction(updateLicenseAction, { params: { id: license.id } })}
                                        title="Endre lisens"
                                        submitText="Endre"
                                    >
                                        <TextInput name="name" label="Navn" defaultValue={license.name} />
                                        <TextInput name="link" label="Link" defaultValue={license.link} />
                                    </Form>

                                    <Form
                                        action={configureAction(destroyLicenseAction, { params: { id: license.id } })}
                                        submitText="Slett"
                                        submitColor="red"
                                        refreshOnSuccess
                                    />
                                </SettingsHeaderItemPopUp>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <Form
                action={createLicenseAction}
                title="Lag ny lisens"
                submitText="Lag"
                refreshOnSuccess
            >
                <TextInput name="name" label="Navn" />
                <TextInput name="link" label="Link" />
            </Form>
        </div>
    ),
})

export default page
export { generateMetadata }
