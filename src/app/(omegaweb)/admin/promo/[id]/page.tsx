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
import { promoAuth } from '@/services/promo/auth'
import { serverPage } from '@/app/ServerPage'
import { configureAction } from '@/services/configureAction'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params }: PageOperationArgs<{ id: string }>) =>
        promoOperations.read({ params: { promoId: Number(params.id) } }),
    capabilities: () => ({
        canUpdatePromoImage: promoAuth.updateImage,
        canUpdatePromo: promoAuth.update,
        canDestroyPromo: promoAuth.destroy,
    }),
    metadata: (promo) => ({ title: `Rediger promo: ${promo.title}` }),
    render: ({ data: promo, capabilities }) => (
        <PageWrapper>
            <div className="flex flex-col items-start gap-2 mb-4">
                <Image width={400} image={promo.image} hideCredit hideCopyRight />
                {capabilities.canUpdatePromoImage.authorized &&
                <PopUp title="Endre bilde for promo"
                    popUpKey="EditPromoImage"
                    showButtonContent="Endre bilde"
                    showButtonClass="secondary-btn block py-[0.25em]! px-[0.5em]! text-s! whitespace-nowrap"
                >
                    <ImageUploader
                        refreshOnSuccess
                        closePopUpOnSuccess="EditPromoImage"
                        uploadImageAction={configureAction(
                            updatePromoImageAction,
                            { params: { promoId: promo.id } }
                        )}
                    />
                </PopUp>
                }
            </div>
            {capabilities.canUpdatePromo.authorized &&
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
            }
            {capabilities.canDestroyPromo.authorized &&
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
            }
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
