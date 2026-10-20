import { Require } from '@/auth/authorizer/Require'

/**
 * A reservation made on behalf of a group takes an active membership of that group. One made on
 * behalf of no group (`groupId` null) is the user's own.
 */
const memberOfReservingGroup = Require.custom<{ groupId: number | null }>(
    ({ session, groupId }) => groupId === null || session.memberships.some(
        membership => membership.groupId === groupId && membership.active
    ),
    { errorMessage: 'Du må høre til gruppen du reserverer for.' }
)

/**
 * Users reserve lockers for themselves only, and only they change their reservations afterwards.
 */
const reservationOfUser = Require.permission('LOCKER_USE').userId().allOf(memberOfReservingGroup)

export const lockerReservationAuth = {
    create: reservationOfUser,
    read: Require.permission('LOCKER_USE'),
    update: reservationOfUser,
    deactivate: Require.permission('LOCKER_ADMIN').or().permission('LOCKER_USE').userId(),
} as const
