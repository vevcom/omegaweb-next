'use client'
import { implementDoubleLevelVisibilityComponents } from '@/components/Visibility/VisibilityComponents'
import { configureAction } from '@/services/configureAction'
import {
    updateArticleCategoryAdminLevelVisibilityAction,
    updateArticleCategoryRegularLevelVisibilityAction,
} from '@/services/articleCategories/actions'
import { articleCategoryAuth } from '@/services/articleCategories/auth'

export const articleCategoryVisibility = implementDoubleLevelVisibilityComponents<{ id: number }>({
    regular: {
        verb: 'kan lese artiklene',
        everyone: 'Alle',
        defaultMembershipRequirement: { order: 'CURRENT_GROUP_ORDER', onlyActive: false },
        update: implementationParams => configureAction(
            updateArticleCategoryRegularLevelVisibilityAction,
            { implementationParams },
        ),
        updateAuthorizer: visibility => articleCategoryAuth.updateRegularLevel.data({ visibility }),
    },
    admin: {
        verb: 'kan redigere artiklene',
        defaultMembershipRequirement: { order: null, onlyActive: true },
        update: implementationParams => configureAction(
            updateArticleCategoryAdminLevelVisibilityAction,
            { implementationParams },
        ),
        updateAuthorizer: visibility => articleCategoryAuth.updateAdminLevel.data({ visibility }),
    },
})
