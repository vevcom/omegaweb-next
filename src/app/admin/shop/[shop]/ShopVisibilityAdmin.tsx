'use client'
import styles from './ShopVisibilityAdmin.module.scss'
import PopUp from '@/components/PopUp/PopUp'
import VisibilityAdmin from '@/components/Visibility/VisibilityAdmin/VisibilityAdmin'
import useAuthorizer from '@/hooks/useAuthorizer'
import {
    updateShopAdminLevelVisibilityAction,
    updateShopRegularLevelVisibilityAction,
} from '@/services/shop/actions'
import { shopAuth } from '@/services/shop/shop/auth'
import { configureAction } from '@/services/configureAction'
import type { ExtendedShop } from '@/services/shop/shop/types'

export default function ShopVisibilityAdmin({ shop }: { shop: ExtendedShop }) {
    const canUpdateRegularLevel = useAuthorizer({
        authorizer: shopAuth.updateRegularLevel.data({ visibility: shop.visibility })
    }).authorized
    const canUpdateAdminLevel = useAuthorizer({
        authorizer: shopAuth.updateAdminLevel.data({ visibility: shop.visibility })
    }).authorized

    if (!canUpdateRegularLevel && !canUpdateAdminLevel) return <></>

    return (
        <PopUp
            popUpKey="shopVisibility"
            showButtonClass={styles.button}
            showButtonContent="Synlighet"
        >
            {canUpdateRegularLevel && (
                <div className={styles.visibility}>
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
                <div className={styles.visibility}>
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
        </PopUp>
    )
}
