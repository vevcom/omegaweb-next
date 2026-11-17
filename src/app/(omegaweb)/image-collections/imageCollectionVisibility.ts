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
        update: implementationParams => configureAction(
            updateDynamicImageCollectionRegularLevelVisibilityAction,
            { implementationParams },
        ),
        updateAuthorizer: visibility => dynamicImageAuth.updateRegularLevel.data({ visibility }),
    },
    admin: {
        verb: 'kan administrere albumet',
        update: implementationParams => configureAction(
            updateDynamicImageCollectionAdminLevelVisibilityAction,
            { implementationParams },
        ),
        updateAuthorizer: visibility => dynamicImageAuth.updateAdminLevel.data({ visibility }),
    },
})
