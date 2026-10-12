import FlairTable from './FlairTable'
import styles from './page.module.scss'
import { createFlairAction, updateFlairImageAction } from '@/services/flairs/actions'
import { flairOperations } from '@/services/flairs/operations'
import { serverPage } from '@/app/serverPage'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import Form from '@/components/Form/Form'
import ColorInput from '@/components/UI/ColorInput'
import TextInput from '@/components/UI/TextInput'
import FileInput from '@/components/UI/FileInput'
import LicenseChooser from '@/components/LicenseChooser/LicenseChooser'
import Flair from '@/components/Flair/Flair'
import ImageUploader from '@/components/Image/ImageUploader'
import PopUp from '@/components/PopUp/PopUp'
import { configureAction } from '@/services/configureAction'
import { authorizeAdminPage } from '@/app/admin/authorizeAdminPage'
import type { FlairRow } from './FlairTable'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        authorizeAdminPage('flairs', session)
        return flairOperations.readAll({})
    },
    metadata: () => ({ title: 'Administrer flairs' }),
    render: ({ data: flairs }) => {
        const rows: FlairRow[] = [...flairs].sort((one, two) => one.rank - two.rank).map(flair => ({
            id: flair.id,
            image: <>
                <Flair flair={flair} width={100} />
                <PopUp
                    popUpKey={`EditFlairImage${flair.id}`}
                    showButtonContent="Endre bilde"
                    showButtonClass={styles.changeImageBtn}
                >
                    <ImageUploader
                        title={`Endre bilde for ${flair.name}`}
                        refreshOnSuccess
                        closePopUpOnSuccess={`EditFlairImage${flair.id}`}
                        uploadImageAction={configureAction(
                            updateFlairImageAction,
                            { params: { flairId: flair.id } }
                        )}
                    />
                </PopUp>
            </>,
            name: flair.name,
            colorStyle: { backgroundColor: `rgb(${flair.colorR}, ${flair.colorG}, ${flair.colorB})` },
            editHref: `/admin/flairs/${flair.id}`,
        }))

        return (
            <PageWrapper headerItem={
                <AddHeaderItemPopUp popUpKey="CreateFlair">
                    <Form
                        title="Opprett ny flair"
                        submitText="Opprett flair"
                        action={createFlairAction}
                        closePopUpOnSuccess="CreateFlair"
                        refreshOnSuccess
                    >
                        <TextInput label="Navn" name="name" />
                        <ColorInput label="Farge" name="color" />
                        <FileInput label="Bilde" name="imageFile" color="primary" />
                        <TextInput label="Alternativ tekst for bilde" name="imageAlt" />
                        <TextInput label="Kreditert" name="imageCredit" />
                        <LicenseChooser name="imageLicenseId" />
                    </Form>
                </AddHeaderItemPopUp>
            }>
                <p>
                    Flairen med lavest <strong>rank</strong> er den som vises først på brukerens profil, og
                    den som bestemmer fargen på brukerprofilen. Dra i håndtaket for å endre rekkefølgen.
                </p>
                <FlairTable rows={rows} />
            </PageWrapper>
        )
    },
})

export default page
export { generateMetadata }
