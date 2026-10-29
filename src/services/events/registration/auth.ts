import { regularLevelUnlessDraft } from '@/services/events/auth'
import { Require } from '@/auth/authorizer/Require'
import type { DoubleLevelVisibilityMatrix } from '@/services/visibility/types'

/**
 * The regular level of an event is what it takes to register for it, and its admin level is what it
 * takes to act on the registrations of everyone else. EVENT_ADMIN bypasses both for every event.
 * Both still need `{ visibility: DoubleLevelVisibilityMatrix }` supplied via `.data()`; registering
 * also needs `{ published }`, as no one but its administrators may register for a draft.
 */
const registerLevel = regularLevelUnlessDraft
const eventAdminLevel = Require.permission('EVENT_ADMIN').or().levelOfDoubleVisibility({ level: 'adminLevel' })

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
const registrationOfUser = ({ userId, doubleLevelMatrix }: {
    userId: number | null,
    doubleLevelMatrix: DoubleLevelVisibilityMatrix,
}) => {
    const admin = eventAdminLevel.data({ visibility: doubleLevelMatrix })
    return userId === null ? admin : userIdOrEventAdmin.data({ userId }).or().allOf(admin)
}

export const eventRegistrationAuth = {
    /**
     * Registering yourself takes the regular level of the event. Registering as an administrator -
     * anyone, outside the registration period, past their dots - takes its admin level.
     */
    create: Require.allOf(registerLevel, Require.userId()),
    createAsAdmin: eventAdminLevel,
    createGuest: eventAdminLevel,

    readDotPunishmentOfUser: userIdOrEventAdmin,
    readOfUser: registrationOfUser,
    readPage: Require.allOf(Require.user(), registerLevel),
    readPageDetailed: eventAdminLevel,

    updateNotes: registrationOfUser,
    /**
     * Unregistering yourself, within the registration period and never from a binding registration.
     * Unregistering as an administrator takes the admin level of the event, and removes anyone at
     * any time.
     */
    destroy: ownRegistration,
    destroyAsAdmin: eventAdminLevel,
    move: eventAdminLevel,
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
    // (its registerLevel branch is gated on event visibility, not userId - fine for
    // "register yourself or someone else", wrong for "spend someone else's ledger balance").
    // Provider/account-ownership rules are not this operation's business - paymentOperations.create
    // and ledgerTransactionOperations.create already own those.
    createPayment: userIdOrEventAdmin,
} as const
