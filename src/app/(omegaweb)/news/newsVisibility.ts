'use client'
import { implementDoubleLevelVisibilityComponents } from '@/components/Visibility/VisibilityComponents'
import { configureAction } from '@/services/configureAction'
import {
    updateNewsAdminLevelVisibilityAction,
    updateNewsRegularLevelVisibilityAction,
} from '@/services/news/actions'
import { newsAuth } from '@/services/news/auth'

export const newsVisibility = implementDoubleLevelVisibilityComponents<{ id: number }>({
    regular: {
        verb: 'kan lese nyheten',
        everyone: 'Alle',
        pickedGroupStartsAs: 'NEWEST_ORDER',
        update: implementationParams => configureAction(updateNewsRegularLevelVisibilityAction, { implementationParams }),
        updateAuthorizer: visibility => newsAuth.updateRegularLevel.data({ visibility }),
    },
    admin: {
        verb: 'kan administrere nyheten',
        pickedGroupStartsAs: 'ACTIVE',
        update: implementationParams => configureAction(updateNewsAdminLevelVisibilityAction, { implementationParams }),
        updateAuthorizer: visibility => newsAuth.updateAdminLevel.data({ visibility }),
    },
})
