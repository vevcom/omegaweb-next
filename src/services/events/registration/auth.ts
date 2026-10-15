import { Require } from '@/auth/authorizer/Require'
import type { DoubleLevelVisibilityMatrix } from '@/services/visibility/types'

/**
 * The regular level of an event is what it takes to register for it, and its admin level is what it
 * takes to act on the registrations of everyone else. EVENT_ADMIN bypasses both for every event.
 * Both still need `{ visibility: DoubleLevelVisibilityMatrix }` supplied via `.data()`.
 */
const registerLevel = Require.permission('EVENT_ADMIN').or().levelOfDoubleVisibility({ level: 'regularLevel' })
// Exported for the operations to tell whether the session administrates an event, which lets it
// unregister anyone after the registration period.
export const eventAdminLevel = Require.permission('EVENT_ADMIN').or().levelOfDoubleVisibility({ level: 'adminLevel' })

const eventAdminAsUser = Require.allOf(eventAdminLevel, Require.userId())
const userIdOrEventAdmin = Require.permission('EVENT_ADMIN').or().userId()

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
    destroy: registrationOfUser,

    // Never the registrant's own: marking yourself as shown up would dodge the dots for not showing up.
    registerAttendance: eventAdminAsUser,
    setAttendance: eventAdminAsUser,
    readAttendanceCounts: eventAdminLevel,

    // Domain access only: may this session pay for *this* registration - the registrant
    // themselves, or a genuine event admin. Deliberately not eventRegistrationAuth.create
    // (its registerLevel branch is gated on event visibility, not userId - fine for
    // "register yourself or someone else", wrong for "spend someone else's ledger balance").
    // Provider/account-ownership rules are not this operation's business - paymentOperations.create
    // and ledgerTransactionOperations.create already own those.
    createPayment: userIdOrEventAdmin,
} as const
