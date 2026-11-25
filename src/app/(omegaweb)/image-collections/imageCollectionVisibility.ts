'use client'
import { implementDoubleLevelVisibilityComponents } from '@/components/Visibility/VisibilityComponents'
import { configureAction } from '@/services/configureAction'
import {
    updateDynamicImageCollectionAdminLevelVisibilityAction,
    updateDynamicImageCollectionRegularLevelVisibilityAction,
} from '@/services/images/dynamic/actions'
import { dynamicImageAuth } from '@/services/images/dynamic/auth'

export const imageCollectionVisibility = implementDoubleLevelVisibilityComponents<{ collectionId: number }>({
    regular: {
        verb: 'kan se albumet',
        everyone: 'Alle',
        defaultMembershipRequirement: { order: 'CURRENT_GROUP_ORDER', onlyActive: false },
        update: implementationParams => configureAction(
            updateDynamicImageCollectionRegularLevelVisibilityAction,
            { implementationParams },
        ),
        updateAuthorizer: visibility => dynamicImageAuth.updateRegularLevel.data({ visibility }),
    },
    admin: {
        verb: 'kan administrere albumet',
        defaultMembershipRequirement: { order: null, onlyActive: true },
        update: implementationParams => configureAction(
            updateDynamicImageCollectionAdminLevelVisibilityAction,
            { implementationParams },
        ),
        updateAuthorizer: visibility => dynamicImageAuth.updateAdminLevel.data({ visibility }),
    },
})
