import { createPromoAction } from '@/services/promo/actions'
import { promoOperations } from '@/services/promo/operations'
import { serverPage } from '@/app/serverPage'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import Textarea from '@/components/UI/Textarea'
import DateInput from '@/components/UI/DateInput'
import FileInput from '@/components/UI/FileInput'
import LicenseChooser from '@/components/LicenseChooser/LicenseChooser'
import SimpleTable from '@/components/Table/SimpleTable'
import Image from '@/components/Image/Image'
import DateDisplay from '@/components/Date/Date'
import { authorizeAdminPage } from '@/app/admin/authorizeAdminPage'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        authorizeAdminPage('promo', session)
        return promoOperations.readAll({})
    },
    metadata: () => ({ title: 'Administrer promo' }),
    render: ({ data: promos }) => {
        const now = new Date()

        return (
            <PageWrapper headerItem={
                <AddHeaderItemPopUp popUpKey="CreatePromo">
                    <Form
                        title="Opprett ny promo"
                        submitText="Opprett promo"
                        action={createPromoAction}
                        closePopUpOnSuccess="CreatePromo"
                        refreshOnSuccess
                    >
                        <TextInput label="Tittel" name="title" />
                        <Textarea label="Tekst" name="text" />
                        <TextInput label="Lenke" name="link" />
                        <DateInput label="Fra" name="startDate" includeTime />
                        <DateInput label="Til" name="endDate" includeTime />
                        <FileInput label="Bakgrunnsbilde" name="imageFile" color="primary" />
                        <TextInput label="Alternativ tekst for bilde" name="imageAlt" />
                        <TextInput label="Kreditert" name="imageCredit" />
                        <LicenseChooser name="imageLicenseId" />
                    </Form>
                </AddHeaderItemPopUp>
            }>
                <p>
                    Promoen vises som en bar under forsidebildet, kun i perioden mellom fra- og til-dato.
                    Er flere perioder aktive samtidig vises den som ble opprettet sist.
                </p>
                <SimpleTable
                    header={['Bilde', 'Tittel', 'Periode', 'Status']}
                    body={promos.map(promo => [
                        <Image key={promo.id} width={100} image={promo.image} hideCredit hideCopyRight />,
                        promo.title,
                        <>
                            <DateDisplay date={promo.startDate} includeTime={false} />
                            {' – '}
                            <DateDisplay date={promo.endDate} includeTime={false} />
                        </>,
                        promo.startDate <= now && promo.endDate >= now ? 'Aktiv' : 'Inaktiv',
                    ])}
                    links={promos.map(promo => `/admin/promo/${promo.id}`)}
                />
            </PageWrapper>
        )
    },
})

export default page
export { generateMetadata }
