'use client'
import VisibilityAdmin from '@/components/Visibility/VisibilityAdmin/VisibilityAdmin'
import useAuthorizer from '@/hooks/useAuthorizer'
import {
    updateShopAdminLevelVisibilityAction,
    updateShopRegularLevelVisibilityAction,
} from '@/services/shop/shop/actions'
import { shopAuth } from '@/services/shop/shop/auth'
import { configureAction } from '@/services/configureAction'
import type { ExtendedShop } from '@/services/shop/shop/types'

/** The two visibility levels of a shop: who may shop there, and who may administer it. */
export default function ShopVisibilityAdmin({ shop }: { shop: ExtendedShop }) {
    const canUpdateRegularLevel = useAuthorizer({
        authorizer: shopAuth.updateRegularLevel.data({ visibility: shop.visibility })
    }).authorized
    const canUpdateAdminLevel = useAuthorizer({
        authorizer: shopAuth.updateAdminLevel.data({ visibility: shop.visibility })
    }).authorized

    if (!canUpdateRegularLevel && !canUpdateAdminLevel) return null

    return <>
        {canUpdateRegularLevel && (
            <div className="flex flex-col gap-[0.5rem] mt-[1em]">
                <h3>Hvem kan handle i butikken?</h3>
                <VisibilityAdmin
                    visibility={shop.visibility.regularLevel}
                    visibilityId={shop.visibilityRegularId}
                    updateVisibilityAction={configureAction(
                        updateShopRegularLevelVisibilityAction,
                        { implementationParams: { shopId: shop.id } }
                    )}
                />
            </div>
        )}
        {canUpdateAdminLevel && (
            <div className="flex flex-col gap-[0.5rem] mt-[1em]">
                <h3>Hvem kan administrere butikken?</h3>
                <VisibilityAdmin
                    visibility={shop.visibility.adminLevel}
                    visibilityId={shop.visibilityAdminId}
                    updateVisibilityAction={configureAction(
                        updateShopAdminLevelVisibilityAction,
                        { implementationParams: { shopId: shop.id } }
                    )}
                />
            </div>
        )}
    </>
}
