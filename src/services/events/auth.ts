import { Require } from '@/auth/authorizer/Require'
import { visibilityFilter } from '@/auth/visibility/visibilityFilter'
import { ledgerAccountAccess } from '@/services/ledger/accounts/ownership'
import type { SessionMaybeUser } from '@/auth/session/Session'
import type { EventCanView, Prisma } from '@/prisma-generated-pn-types'
import type { VisibilityMatrix } from '@/services/visibility/types'

/**
 * Whether no one administrates an event but those with EVENT_ADMIN: it has no requirements, or one
 * without conditions, which passes no one.
 */
export function hasNoAdministrators(adminVisibility: VisibilityMatrix) {
    return adminVisibility.requirements.length === 0
        || adminVisibility.requirements.some(requirement => requirement.conditions.length === 0)
}

/**
 * The admin visibility of an event decides who may change it, its quotas and its registrations.
 * EVENT_ADMIN bypasses it for every event. The creator holds a draft while no one administrates it,
 * as with one made from just a name, and a host chosen later takes over at once. Needs
 * `{ adminVisibility, published, creatorId }` supplied via `.data()`.
 */
const isCreatorOfDraft = Require.custom<{ published: boolean, creatorId: number | null, adminVisibility: VisibilityMatrix }>(
    ({ session, published, creatorId, adminVisibility }) => (
        !published && creatorId !== null && session.user?.id === creatorId && hasNoAdministrators(adminVisibility)
    )
)

export const eventAdminLevel = Require.anyOf(
    Require.permission('EVENT_ADMIN'),
    Require.visibility({ key: 'adminVisibility' }),
    isCreatorOfDraft,
)

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

/** `hasNoAdministrators` as a where clause on a visibility. */
const noAdministrators: Prisma.VisibilityWhereInput = {
    OR: [{ requirements: { none: {} } }, { requirements: { some: { conditions: { none: {} } } } }],
}

/** The same rule as `canSeeEvent`, as a where clause on events. */
export function eventsSeenBy(session: SessionMaybeUser): Prisma.EventWhereInput {
    const passes = visibilityFilter(session.memberships)
    return {
        OR: [
            { visibilityAdmin: passes },
            ...(session.user ? [{ published: false, createdById: session.user.id, visibilityAdmin: noAdministrators }] : []),
            { published: true, canBeViewedBy: 'ALL' },
            { published: true, variants: { some: { quotas: { some: { visibility: passes } } } } },
        ],
    }
}

/** `eventsSeenBy` as a filter over a list of events. EVENT_ADMIN lists them unfiltered. */
const visibleEvents = Require.permission('EVENT_ADMIN').or().filter(({ session }) => eventsSeenBy(session))

export const eventAuth = {
    // A new event has no visibility yet to check. EVENT_CREATE is the only gate here. The creator
    // sets the event's admin visibility, which then governs every operation below.
    create: Require.permission('EVENT_ADMIN').or().permission('EVENT_CREATE'),

    readAdminVisibility: canSeeEvent,

    read: canSeeEvent,
    readStatistics: eventAdminLevel,
    readManyCurrent: visibleEvents,
    readManyArchivedPage: visibleEvents,
    search: visibleEvents,

    update: eventAdminLevel,
    saveSetup: eventAdminLevel,
    connectToLedgerAccount: Require.allOf(eventAdminLevel, ledgerAccountAccess('LEDGER_ADMIN')),
    setPublished: eventAdminLevel,
    updateCmsCoverImage: eventAdminLevel,
    updateParagraphContent: eventAdminLevel,
    destroy: eventAdminLevel,
} as const
