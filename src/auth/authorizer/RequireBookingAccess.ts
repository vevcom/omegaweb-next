import { Require } from './Require'
import { secretsMatch } from '@/lib/secretsMatch'
import type { SessionMaybeUser } from '@/auth/session/Session'
import type { Permission } from '@/prisma-generated-pn-types'

type BookingAccess = {
    booking: { userId: number | null, secret: string },
    providedSecret: string | undefined,
}

function holdsBooking({ session, booking, providedSecret }: { session: SessionMaybeUser } & BookingAccess) {
    return (session.user !== null && session.user.id === booking.userId) ||
        (providedSecret !== undefined && secretsMatch(providedSecret, booking.secret))
}

const notHolderErrorMessage = 'Du har ikke tilgang til denne bookingen.'

/**
 * Authorized if the session holds `permission`, the session user owns the booking, or the
 * caller supplied the booking's secret. The secret is how a guest booking (created without a
 * session) can be resumed and paid for later without logging in.
 *
 * Needs `{ booking, providedSecret }` supplied via `.data()`.
 */
export function requireBookingAccess(permission: Permission) {
    return Require.permission(permission).or().custom<BookingAccess>(holdsBooking, { errorMessage: notHolderErrorMessage })
}

/**
 * Authorized only for the holder of the booking: the session user owning it, or the caller
 * supplying its secret. No permission stands in for being the holder.
 *
 * Needs `{ booking, providedSecret }` supplied via `.data()`.
 */
export function requireBookingHolder() {
    return Require.custom<BookingAccess>(holdsBooking, { errorMessage: notHolderErrorMessage })
}
