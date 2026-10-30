import { Require } from '@/auth/authorizer/Require'
import { visibilityFilter } from '@/auth/visibility/visibilityFilter'
import { ledgerAccountAccess } from '@/services/ledger/accounts/ownership'
import type { EventCanView, Prisma } from '@/prisma-generated-pn-types'

/**
 * The admin visibility of an event decides who may change it, its quotas and its registrations.
 * EVENT_ADMIN bypasses it for every event. Needs `{ adminVisibility }` supplied via `.data()`.
 */
export const eventAdminLevel = Require.permission('EVENT_ADMIN').or().visibility({ key: 'adminVisibility' })

/**
 * Passes when the event's `published` flag, supplied via `.data()`, is `expected`. It fails
 * without a message of its own: it only picks which rule applies, and the message of the rule
 * that was checked is the one worth reporting.
 */
export const isPublished = (expected: boolean) => Require.custom<{ published: boolean }>(
    ({ published }) => (published === expected ? { success: true } : { success: false })
)

/**
 * Passes when the event is published and marked as viewable by all, so that no visibility is
 * checked. Needs `{ published, canBeViewedBy }` supplied via `.data()`. Like `isPublished`, it fails
 * without a message of its own.
 */
const isViewableByAll = Require.custom<{ published: boolean, canBeViewedBy: EventCanView }>(
    ({ published, canBeViewedBy }) => (published && canBeViewedBy === 'ALL' ? { success: true } : { success: false })
)

/**
 * Who may see an event: everyone when it is published and viewable by all, those who administrate
 * it, and, once published, anyone passing the visibility of one of its quotas. A draft is its
 * administrators' alone. Needs `EventAccess` (see types.ts) supplied via `.data()`.
 */
export const canSeeEvent = Require.anyOf(
    isViewableByAll,
    eventAdminLevel,
    isPublished(true).anyVisibility({ key: 'quotaVisibilities' }),
)

/** The same rule as `canSeeEvent`, as a filter over a list of events. EVENT_ADMIN lists them unfiltered. */
const visibleEvents = Require.permission('EVENT_ADMIN').or().filter(({ session }): Prisma.EventWhereInput => {
    const passes = visibilityFilter(session.memberships)
    return {
        OR: [
            { visibilityAdmin: passes },
            { published: true, canBeViewedBy: 'ALL' },
            { published: true, quotas: { some: { visibility: passes } } },
        ],
    }
})

export const eventAuth = {
    // A new event has no visibility yet to check. EVENT_CREATE is the only gate here. The creator
    // sets the event's admin visibility, which then governs every operation below.
    create: Require.permission('EVENT_ADMIN').or().permission('EVENT_CREATE'),

    readAdminVisibility: canSeeEvent,
    updateAdminVisibility: eventAdminLevel,

    read: canSeeEvent,
    readManyCurrent: visibleEvents,
    readManyArchivedPage: visibleEvents,
    search: visibleEvents,

    update: eventAdminLevel,
    connectToLedgerAccount: Require.allOf(eventAdminLevel, ledgerAccountAccess('LEDGER_ADMIN')),
    setPublished: eventAdminLevel,
    updateCmsCoverImage: eventAdminLevel,
    updateParagraphContent: eventAdminLevel,
    destroy: eventAdminLevel,
} as const
