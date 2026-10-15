import { Require } from '@/auth/authorizer/Require'
import type { DoubleLevelVisibilityMatrix } from '@/services/visibility/types'

/**
 * The admin level of an event decides who may edit and delete it. The regular level decides who
 * may register for it, and who may see it at all when it isn't viewable by everyone. EVENT_ADMIN
 * bypasses both levels for every event.
 */
const regularLevel = Require.permission('EVENT_ADMIN').or().levelOfDoubleVisibility({ level: 'regularLevel' })
const adminLevel = Require.permission('EVENT_ADMIN').or().levelOfDoubleVisibility({ level: 'adminLevel' })

/**
 * Passes when the event's `published` flag, supplied via `.data()`, is `expected`. It fails
 * without a message of its own: it only picks which of the two levels applies, and the message
 * of the level that was checked is the one worth reporting.
 */
const isPublished = (expected: boolean) => Require.custom<{ published: boolean }>(
    ({ published }) => (published === expected ? { success: true } : { success: false })
)

/**
 * The regular level of a published event. A draft belongs to those who administrate it, so until
 * the event is published, whatever the regular level grants takes the admin level instead.
 * Needs `{ published, visibility }` supplied via `.data()`.
 */
export const regularLevelUnlessDraft = Require.anyOf(
    isPublished(true).allOf(regularLevel),
    isPublished(false).allOf(adminLevel),
)

export const eventAuth = {
    // A new event has no visibility matrix yet to check. EVENT_CREATE is the only gate here. The
    // creator sets the event's own visibility, which then governs every operation below.
    create: Require.permission('EVENT_ADMIN').or().permission('EVENT_CREATE'),

    readDoubleLevelMatrix: regularLevelUnlessDraft,
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
