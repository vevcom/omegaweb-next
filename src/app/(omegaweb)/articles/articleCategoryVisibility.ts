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
        pickedGroupStartsAs: 'NEWEST_ORDER',
        update: implementationParams => configureAction(
            updateArticleCategoryRegularLevelVisibilityAction,
            { implementationParams },
        ),
        updateAuthorizer: visibility => articleCategoryAuth.updateRegularLevel.data({ visibility }),
    },
    admin: {
        verb: 'kan redigere artiklene',
        pickedGroupStartsAs: 'ACTIVE',
        update: implementationParams => configureAction(
            updateArticleCategoryAdminLevelVisibilityAction,
            { implementationParams },
        ),
        updateAuthorizer: visibility => articleCategoryAuth.updateAdminLevel.data({ visibility }),
    },
})
