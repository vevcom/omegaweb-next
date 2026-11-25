'use client'
import { implementDoubleLevelVisibilityComponents } from '@/components/Visibility/VisibilityComponents'
import {
    adminDefaultMembershipRequirements,
    regularDefaultMembershipRequirements,
} from '@/components/Visibility/defaultMembershipRequirements'
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
        defaultMembershipRequirements: regularDefaultMembershipRequirements,
        update: implementationParams => configureAction(updateNewsRegularLevelVisibilityAction, { implementationParams }),
        updateAuthorizer: visibility => newsAuth.updateRegularLevel.data({ visibility }),
    },
    admin: {
        verb: 'kan administrere nyheten',
        defaultMembershipRequirements: adminDefaultMembershipRequirements,
        update: implementationParams => configureAction(updateNewsAdminLevelVisibilityAction, { implementationParams }),
        updateAuthorizer: visibility => newsAuth.updateAdminLevel.data({ visibility }),
    },
})
