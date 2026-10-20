import { screenPageIncluder } from './pages/constants'
import type { Prisma, ScreenOrientation } from '@/prisma-generated-pn-types'

export const screenIncluder = {
    pages: {
        orderBy: { order: 'asc' },
        include: {
            screenPage: { include: screenPageIncluder },
        },
    },
} as const satisfies Prisma.ScreenInclude

export const screenOrientationLabels = {
    LANDSCAPE: 'Liggende',
    PORTRAIT: 'Stående',
} as const satisfies Record<ScreenOrientation, string>

// /screens/pages/[id] edits a page, so a screen of that name could not be shown at /screens/[name].
export const reservedScreenNames = ['pages']
