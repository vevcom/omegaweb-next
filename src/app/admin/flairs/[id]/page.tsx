import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import { destroyFlairAction, updateFlairAction } from '@/services/flairs/actions'
import { flairOperations } from '@/services/flairs/operations'
import { serverPage } from '@/app/serverPage'
import { configureAction } from '@/services/configureAction'
import Flair from '@/components/Flair/Flair'
import ColorInput from '@/components/UI/ColorInput'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params }: PageOperationArgs<{ id: string }>) =>
        flairOperations.read({ params: { flairId: Number(params.id) } }),
    metadata: (flair) => ({ title: `Rediger flair: ${flair.name}` }),
    render: ({ data: flair }) => (
        <PageWrapper>
            <Flair flair={flair} width={200} />
            <Form
                title="Oppdater flair"
                submitText="Oppdater flair"
                action={configureAction(updateFlairAction, { params: { flairId: flair.id } })}
                refreshOnSuccess
            >
                <TextInput defaultValue={flair.name} label="Navn" name="name" />
                <ColorInput defaultValueRGB={{
                    red: flair.colorR,
                    green: flair.colorG,
                    blue: flair.colorB
                }} label="Farge" name="color" />
            </Form>
            <Form
                title="Slett flair"
                submitText="Slett flair"
                action={configureAction(destroyFlairAction, { params: { flairId: flair.id } })}
                navigateOnSuccess="/admin/flairs"
                submitColor="red"
                confirmation={{
                    confirm: true,
                    text: `
                        Er du sikker på at du vil slette flairsen "${flair.name}"?
                        Dette kan ikke angres, og alle brukere som har denne flairsen vil miste den.
                    `
                }}
            />
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
