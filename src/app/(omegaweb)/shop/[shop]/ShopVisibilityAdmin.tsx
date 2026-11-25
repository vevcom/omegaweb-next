'use client'
import { shopVisibility } from '@/app/(omegaweb)/shop/shopVisibility'
import type { ExtendedShop } from '@/services/shop/shop/types'

/** The two visibility levels of a shop: who may shop there, and who may administer it. */
export default function ShopVisibilityAdmin({ shop }: { shop: ExtendedShop }) {
    return <div className="flex flex-col gap-4 mt-[1em]">
        <shopVisibility.Forms
            doubleLevelVisibility={shop.visibility}
            visibilityIds={{ regular: shop.visibilityRegularId, admin: shop.visibilityAdminId }}
            params={{ shopId: shop.id }}
        />
    </div>
}
