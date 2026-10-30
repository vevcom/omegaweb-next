import { canSeeEvent, eventAdminLevel, isPublished } from '@/services/events/auth'
import { Require } from '@/auth/authorizer/Require'
import type { EventAccess } from '@/services/events/types'

/**
 * Registering takes passing the visibility of one of the event's quotas once it is published, or
 * administrating the event, which also registers for a draft. Needs `EventAccess` via `.data()`.
 */
export const canRegister = Require.anyOf(
    eventAdminLevel,
    isPublished(true).anyVisibility({ key: 'quotaVisibilities' }),
)

const eventAdminAsUser = Require.allOf(eventAdminLevel, Require.userId())
const userIdOrEventAdmin = Require.permission('EVENT_ADMIN').or().userId()

/**
 * Acting on your own registration. A guest registration has no user behind it, so it is no one's
 * own, and only an administrator acts on it.
 */
const ownRegistration = ({ userId }: { userId: number | null }) => (
    userId === null
        ? Require.custom(() => false, { errorMessage: 'Bare arrangørene kan melde av en gjest.' })
        : Require.userId().data({ userId })
)

/**
 * Acting on the registration of a given user: their own, or anyone's for those who administrate the
 * event. A registration with no user behind it is a guest, and only an administrator owns those.
 */
const registrationOfUser = ({ userId, access }: { userId: number | null, access: EventAccess }) => {
    const admin = eventAdminLevel.data(access)
    return userId === null ? admin : userIdOrEventAdmin.data({ userId }).or().allOf(admin)
}

export const eventRegistrationAuth = {
    /**
     * Registering yourself takes a quota of the event. Registering as an administrator - anyone,
     * into any quota, outside the registration period, past their dots - takes its admin level.
     */
    create: Require.allOf(canRegister, Require.userId()),
    createAsAdmin: eventAdminLevel,
    createGuest: eventAdminLevel,

    readDotPunishmentOfUser: userIdOrEventAdmin,
    readOfUser: registrationOfUser,
    // Who is registered is shown to those who may see the event and are logged in.
    readPage: Require.allOf(Require.user(), canSeeEvent),
    readPageDetailed: eventAdminLevel,

    updateNotes: registrationOfUser,
    /**
     * Unregistering yourself, within the registration period of your quota and never from a binding
     * registration. Unregistering as an administrator takes the admin level of the event, and
     * removes anyone at any time.
     */
    destroy: ownRegistration,
    destroyAsAdmin: eventAdminLevel,
    move: eventAdminLevel,
    moveToQuota: eventAdminLevel,
    setManuallyPaid: eventAdminLevel,

    // Never the registrant's own: marking yourself as shown up would dodge the dots for not showing up.
    registerAttendance: eventAdminAsUser,
    setAttendance: eventAdminAsUser,
    readAttendanceCounts: eventAdminLevel,
    readNotAttended: eventAdminLevel,

    createDot: eventAdminAsUser,
    createDotsForNonattendingUsers: eventAdminAsUser,

    // Domain access only: may this session pay for *this* registration - the registrant
    // themselves, or a genuine event admin. Deliberately not eventRegistrationAuth.create
    // (its canRegister branch is gated on event visibility, not userId - fine for
    // "register yourself or someone else", wrong for "spend someone else's ledger balance").
    // Provider/account-ownership rules are not this operation's business - paymentOperations.create
    // and ledgerTransactionOperations.create already own those.
    createPayment: userIdOrEventAdmin,
} as const
