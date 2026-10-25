'use client'
import { createShopProductAction, updateShopProductAction } from '@/services/shop/shop/actions'
import { updateProductAction } from '@/services/shop/product/actions'
import { productAuth } from '@/services/shop/product/auth'
import { configureAction } from '@/services/configureAction'
import { EMPTY_VISIBILITY } from '@/auth/visibility/emptyVisibility'
import useAuthorizer from '@/hooks/useAuthorizer'
import Form from '@/components/Form/Form'
import Checkbox from '@/components/UI/Checkbox'
import NumberInput from '@/components/UI/NumberInput'
import TextInput from '@/components/UI/TextInput'
import { displayAmount } from '@/lib/currency/convert'
import type { ExtendedShop, ShopPageProduct } from '@/services/shop/shop/types'
import type { PopUpKeyType } from '@/contexts/PopUp'

/**
 * Creates a product on sale in the shop, or, given a product, changes how the shop sells it: its
 * price and whether it is on sale. What the product is can be changed from here too, as long as
 * no other shop sells it (see productAuth.update).
 */
export function EditProductForShopForm({
    shop,
    product,
    closePopUpOnSuccess,
}: {
    shop: Pick<ExtendedShop, 'id' | 'visibility'>,
    product?: ShopPageProduct,
    closePopUpOnSuccess?: PopUpKeyType,
}) {
    const canUpdateDetails = useAuthorizer({
        authorizer: productAuth.update.data({ visibility: product?.soldElsewhere ? EMPTY_VISIBILITY : shop.visibility }),
    }).authorized

    if (!product) {
        return <Form
            action={configureAction(createShopProductAction, { params: { shopId: shop.id } })}
            submitText="Lag nytt produkt"
            refreshOnSuccess
            closePopUpOnSuccess={closePopUpOnSuccess}
        >
            <h3>Nytt produkt</h3>
            <TextInput name="name" label="Navn" />
            <TextInput name="description" label="Beskrivelse" />
            <TextInput name="barcode" label="Strekkode" />
            <NumberInput name="price" label="Pris" step={0.01} min={1} />
            <p className="text-s text-text-muted">Bilde legges til på produktkortet når produktet er laget.</p>
        </Form>
    }

    return <>
        <Form
            action={configureAction(updateShopProductAction, { params: { shopId: shop.id, productId: product.id } })}
            submitText="Oppdater"
            refreshOnSuccess
            closePopUpOnSuccess={closePopUpOnSuccess}
        >
            <h3>{product.name} i butikken</h3>
            <NumberInput name="price" label="Pris" step={0.01} min={1} defaultValue={displayAmount(product.price, true)} />
            <Checkbox name="active" label="Aktiv" defaultChecked={product.active} />
        </Form>
        {canUpdateDetails ? (
            <Form
                action={configureAction(updateProductAction, { params: { productId: product.id } })}
                submitText="Oppdater produkt"
                refreshOnSuccess
                closePopUpOnSuccess={closePopUpOnSuccess}
            >
                <h3>Produktet</h3>
                <TextInput name="name" label="Navn" defaultValue={product.name} />
                <TextInput name="description" label="Beskrivelse" defaultValue={product.description} />
                <TextInput name="barcode" label="Strekkode" defaultValue={product.barcode ?? ''} />
                <NumberInput
                    name="suggestedPrice"
                    label="Foreslått pris for andre butikker"
                    step={0.01}
                    min={1}
                    defaultValue={product.suggestedPrice === null ? undefined : displayAmount(product.suggestedPrice, true)}
                />
            </Form>
        ) : (
            <p>Produktet selges også i andre butikker, så navn, beskrivelse og strekkode endres fra produktkatalogen.</p>
        )}
    </>
}
