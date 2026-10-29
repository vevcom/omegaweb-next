import { SettingsHeaderItemPopUp } from '@/app/_components/HeaderItems/HeaderItemPopUp'
import Form from '@/app/_components/Form/Form'
import {
    destroyLicenseAction,
    createLicenseAction,
    updateLicenseAction,
} from '@/services/licenses/actions'
import { licenseOperations } from '@/services/licenses/operations'
import { licenseAuth } from '@/services/licenses/auth'
import { serverPage } from '@/app/ServerPage'
import TextInput from '@/UI/TextInput'
import { configureAction } from '@/services/configureAction'
import { authorizeAdminPage } from '@/app/(omegaweb)/admin/authorizeAdminPage'
import Link from 'next/link'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        authorizeAdminPage('licenses', session)
        return licenseOperations.readAll({})
    },
    capabilities: () => ({
        canCreateLicense: licenseAuth.create,
        canUpdateLicense: licenseAuth.update,
        canDestroyLicense: licenseAuth.destroy,
    }),
    metadata: () => ({ title: 'Lisenser' }),
    render: ({ data: licenses, capabilities }) => (
        <div className="p-[1em]">
            <h1>Lisenser</h1>
            <p>Lisenser brukes for bilder</p>
            <table className="ohma-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Navn</th>
                        <th>Lenke</th>
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
                                <SettingsHeaderItemPopUp title="Endre lisens" popUpKey={`LicenseSettings ${license.id}`}>
                                    {capabilities.canUpdateLicense.authorized &&
                                    <Form
                                        action={configureAction(updateLicenseAction, { params: { id: license.id } })}
                                        submitText="Endre"
                                    >
                                        <TextInput name="name" label="Navn" defaultValue={license.name} />
                                        <TextInput name="link" label="Lenke" defaultValue={license.link} />
                                    </Form>
                                    }

                                    {capabilities.canDestroyLicense.authorized &&
                                    <Form
                                        action={configureAction(destroyLicenseAction, { params: { id: license.id } })}
                                        submitText="Slett"
                                        submitColor="red"
                                        refreshOnSuccess
                                    />
                                    }
                                </SettingsHeaderItemPopUp>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {capabilities.canCreateLicense.authorized &&
            <Form
                action={createLicenseAction}
                title="Lag ny lisens"
                submitText="Lag"
                refreshOnSuccess
            >
                <TextInput name="name" label="Navn" />
                <TextInput name="link" label="Lenke" />
            </Form>
            }
        </div>
    ),
})

export default page
export { generateMetadata }
