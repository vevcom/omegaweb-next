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
        defaultMembershipRequirement: { order: 'CURRENT_GROUP_ORDER', onlyActive: false },
        update: implementationParams => configureAction(updateShopRegularLevelVisibilityAction, { implementationParams }),
        updateAuthorizer: visibility => shopAuth.updateRegularLevel.data({ visibility }),
    },
    admin: {
        verb: 'kan administrere butikken',
        defaultMembershipRequirement: { order: null, onlyActive: true },
        update: implementationParams => configureAction(updateShopAdminLevelVisibilityAction, { implementationParams }),
        updateAuthorizer: visibility => shopAuth.updateAdminLevel.data({ visibility }),
    },
})
