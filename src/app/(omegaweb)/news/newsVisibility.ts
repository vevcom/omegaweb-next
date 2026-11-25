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
        defaultMembershipRequirement: { order: 'CURRENT_GROUP_ORDER', onlyActive: false },
        update: implementationParams => configureAction(updateNewsRegularLevelVisibilityAction, { implementationParams }),
        updateAuthorizer: visibility => newsAuth.updateRegularLevel.data({ visibility }),
    },
    admin: {
        verb: 'kan administrere nyheten',
        defaultMembershipRequirement: { order: null, onlyActive: true },
        update: implementationParams => configureAction(updateNewsAdminLevelVisibilityAction, { implementationParams }),
        updateAuthorizer: visibility => newsAuth.updateAdminLevel.data({ visibility }),
    },
})
