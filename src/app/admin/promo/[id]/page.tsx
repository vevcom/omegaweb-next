import styles from './page.module.scss'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import Textarea from '@/components/UI/Textarea'
import DateInput from '@/components/UI/DateInput'
import PopUp from '@/components/PopUp/PopUp'
import ImageUploader from '@/components/Image/ImageUploader'
import Image from '@/components/Image/Image'
import {
    destroyPromoAction,
    updatePromoAction,
    updatePromoImageAction
} from '@/services/promo/actions'
import { promoOperations } from '@/services/promo/operations'
import { serverPage } from '@/app/serverPage'
import { configureAction } from '@/services/configureAction'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params }: PageOperationArgs<{ id: string }>) =>
        promoOperations.read({ params: { promoId: Number(params.id) } }),
    metadata: (promo) => ({ title: `Rediger promo: ${promo.title}` }),
    render: ({ data: promo }) => (
        <PageWrapper>
            <div className={styles.image}>
                <Image width={400} image={promo.image} hideCredit hideCopyRight />
                <PopUp
                    popUpKey="EditPromoImage"
                    showButtonContent="Endre bilde"
                    showButtonClass={styles.changeImageBtn}
                >
                    <ImageUploader
                        title="Endre bilde for promo"
                        refreshOnSuccess
                        closePopUpOnSuccess="EditPromoImage"
                        uploadImageAction={configureAction(
                            updatePromoImageAction,
                            { params: { promoId: promo.id } }
                        )}
                    />
                </PopUp>
            </div>
            <Form
                title="Oppdater promo"
                submitText="Oppdater promo"
                action={configureAction(updatePromoAction, { params: { promoId: promo.id } })}
                refreshOnSuccess
            >
                <TextInput defaultValue={promo.title} label="Tittel" name="title" />
                <Textarea defaultValue={promo.text} label="Tekst" name="text" />
                <TextInput defaultValue={promo.link} label="Lenke" name="link" />
                <DateInput defaultValue={promo.startDate} includeTime label="Fra" name="startDate" />
                <DateInput defaultValue={promo.endDate} includeTime label="Til" name="endDate" />
            </Form>
            <Form
                title="Slett promo"
                submitText="Slett promo"
                action={configureAction(destroyPromoAction, { params: { promoId: promo.id } })}
                navigateOnSuccess="/admin/promo"
                submitColor="red"
                confirmation={{
                    confirm: true,
                    text: `
                        Er du sikker på at du vil slette promoen "${promo.title}"?
                        Dette kan ikke angres.
                    `
                }}
            />
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
