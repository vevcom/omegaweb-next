'use client'
import { implementDoubleLevelVisibilityComponents } from '@/components/Visibility/VisibilityComponents'
import { configureAction } from '@/services/configureAction'
import {
    updateShopAdminLevelVisibilityAction,
    updateShopRegularLevelVisibilityAction,
} from '@/services/shop/shop/actions'
import { shopAuth } from '@/services/shop/shop/auth'

export const shopVisibility = implementDoubleLevelVisibilityComponents<{ shopId: number }>({
    regular: {
        verb: 'kan handle i butikken',
        everyone: 'Alle',
        update: implementationParams => configureAction(updateShopRegularLevelVisibilityAction, { implementationParams }),
        updateAuthorizer: visibility => shopAuth.updateRegularLevel.data({ visibility }),
    },
    admin: {
        verb: 'kan administrere butikken',
        update: implementationParams => configureAction(updateShopAdminLevelVisibilityAction, { implementationParams }),
        updateAuthorizer: visibility => shopAuth.updateAdminLevel.data({ visibility }),
    },
})
