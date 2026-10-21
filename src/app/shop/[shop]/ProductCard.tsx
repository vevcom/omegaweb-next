'use client'

import { EditProductForShopForm } from './EditProductForShopForm'
import CmsImage from '@/cms/CmsImage/CmsImage'
import PopUp from '@/components/PopUp/PopUp'
import useAuthorizer from '@/hooks/useAuthorizer'
import { displayAmount } from '@/lib/currency/convert'
import { configureAction } from '@/services/configureAction'
import { updateProductCmsImageAction } from '@/services/shop/product/actions'
import { productAuth } from '@/services/shop/product/auth'
import { EMPTY_VISIBILITY } from '@/auth/visibility/emptyVisibility'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMinus, faPencil, faPlus } from '@fortawesome/free-solid-svg-icons'
import type { ExtendedShop, ShopPageProduct } from '@/services/shop/shop/types'

type PropTypes = {
    shop: Pick<ExtendedShop, 'id' | 'visibility'>,
    product: ShopPageProduct,
    quantity: number,
    canUpdateProduct: boolean,
    onAdd: () => void,
    onRemove: () => void,
}

const stepButtonClassName = 'grid place-items-center size-9 rounded-full border-none cursor-pointer '
    + 'bg-surface-hover text-text transition-colors duration-200 hover:bg-accent-blue hover:text-text-inv '
    + '[&_svg]:text-inherit [&_path]:text-inherit'

/** One product on the shop's shelf: its photo, what it costs, and how many are in the cart. */
export default function ProductCard({ shop, product, quantity, canUpdateProduct, onAdd, onRemove }: PropTypes) {
    // A product other shops sell too is the catalogue's to change, photo included (see productAuth.update).
    const canEditImage = useAuthorizer({
        authorizer: productAuth.updateCmsImage.data({
            visibility: product.soldElsewhere ? EMPTY_VISIBILITY : shop.visibility,
        }),
    })

    return (
        <article className={`
            group/card relative flex flex-col overflow-hidden rounded-round bg-surface-raised
            ${product.active ? '' : 'opacity-60'}
        `}>
            <div className="relative aspect-square overflow-hidden bg-surface-hover">
                <CmsImage
                    cmsImage={product.image}
                    updateCmsImageAction={configureAction(
                        updateProductCmsImageAction,
                        { implementationParams: { productId: product.id } },
                    )}
                    capabilities={{ canEdit: canEditImage }}
                    width={400}
                    alt={product.name}
                    className="
                        block! size-full
                        [&_div]:size-full
                        [&_img]:size-full [&_img]:object-cover [&_img]:transition-[scale] [&_img]:duration-500
                        group-hover/card:[&_img]:scale-105
                    "
                />
                {!product.active && (
                    <span className="
                        absolute top-2 left-2 z-1 rounded-full bg-surface-base/90 px-3 py-1 text-s font-medium
                    ">
                        Ikke i salg
                    </span>
                )}
                {quantity > 0 && (
                    <span className="
                        absolute top-2 right-2 z-1 grid place-items-center min-w-8 h-8 px-2 rounded-full bg-accent-blue
                        text-text-inv text-s font-bold
                    ">
                        {quantity}
                    </span>
                )}
            </div>

            <div className="flex flex-1 flex-col gap-1 p-4">
                <div className="flex items-start justify-between gap-2">
                    <h3 className="m-0 text-m font-bold leading-tight wrap-anywhere">{product.name}</h3>
                    {canUpdateProduct && (
                        <PopUp
                            popUpKey={`editProductForShop-${product.id}`}
                            showButtonContent={<FontAwesomeIcon icon={faPencil} />}
                            showButtonClass="
                                shrink-0 grid place-items-center size-8 p-2 rounded-full border-none bg-transparent
                                cursor-pointer text-text-muted
                                hover:text-accent-blue
                                [&_svg]:text-inherit
                                [&_path]:text-inherit
                            "
                        >
                            <EditProductForShopForm
                                shop={shop}
                                product={product}
                                closePopUpOnSuccess={`editProductForShop-${product.id}`}
                            />
                        </PopUp>
                    )}
                </div>
                {product.description && (
                    <p className="m-0 text-s text-text-muted line-clamp-2">{product.description}</p>
                )}

                <div className="mt-auto flex flex-col gap-3 pt-3">
                    <span className="text-l font-bold tabular-nums">{displayAmount(product.price)}</span>
                    {product.active && (
                        quantity === 0 ? (
                            <button
                                type="button"
                                className="
                                    btn m-0! flex w-full items-center justify-center gap-2 h-9 py-0! px-4! rounded-full!
                                    text-s!
                                    [&_svg]:text-inherit
                                    [&_path]:text-inherit
                                "
                                onClick={onAdd}
                            >
                                <FontAwesomeIcon icon={faPlus} />
                                Legg til
                            </button>
                        ) : (
                            <div className="flex items-center justify-between">
                                <button
                                    type="button"
                                    className={stepButtonClassName}
                                    onClick={onRemove}
                                    aria-label={`Fjern én ${product.name}`}
                                >
                                    <FontAwesomeIcon icon={faMinus} />
                                </button>
                                <span className="min-w-6 text-center font-bold tabular-nums">{quantity}</span>
                                <button
                                    type="button"
                                    className={stepButtonClassName}
                                    onClick={onAdd}
                                    aria-label={`Legg til én ${product.name}`}
                                >
                                    <FontAwesomeIcon icon={faPlus} />
                                </button>
                            </div>
                        )
                    )}
                </div>
            </div>
        </article>
    )
}
