import { Require } from '@/auth/authorizer/Require'
import type { DoubleLevelVisibilityMatrix } from '@/services/visibility/types'

/**
 * The admin level of an event decides who may edit and delete it. The regular level decides who
 * may register for it, and who may see it at all when it isn't viewable by everyone. EVENT_ADMIN
 * bypasses both levels for every event.
 */
const regularLevel = Require.permission('EVENT_ADMIN').or().levelOfDoubleVisibility({ level: 'regularLevel' })
const adminLevel = Require.permission('EVENT_ADMIN').or().levelOfDoubleVisibility({ level: 'adminLevel' })

export const eventAuth = {
    // A new event has no visibility matrix yet to check. EVENT_CREATE is the only gate here. The
    // creator sets the event's own visibility, which then governs every operation below.
    create: Require.permission('EVENT_ADMIN').or().permission('EVENT_CREATE'),

    readDoubleLevelMatrix: regularLevel,
    updateRegularLevel: adminLevel,
    updateAdminLevel: adminLevel,

    // The level 'PUBLIC' is for an event marked as viewable by all: then neither level is checked.
    read: ({ level, doubleLevelMatrix }: {
        level: 'PUBLIC' | 'REGULAR' | 'ADMIN',
        doubleLevelMatrix: DoubleLevelVisibilityMatrix,
    }) => {
        if (level === 'PUBLIC') return Require.nothing()
        return (level === 'REGULAR' ? regularLevel : adminLevel).data({ visibility: doubleLevelMatrix })
    },
    readManyCurrent: Require.visibilityFilter({ bypassPermission: 'EVENT_ADMIN' }),
    readManyArchivedPage: Require.visibilityFilter({ bypassPermission: 'EVENT_ADMIN' }),
    search: Require.visibilityFilter({ bypassPermission: 'EVENT_ADMIN' }),

    update: adminLevel,
    setPublished: adminLevel,
    updateCmsCoverImage: adminLevel,
    updateParagraphContent: adminLevel,
    destroy: adminLevel,
} as const
