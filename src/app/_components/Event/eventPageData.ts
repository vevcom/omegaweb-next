import '@pn-server-only'
import { eventRegistrationOperations } from '@/services/events/registration/operations'
import { eventRegistrationAuth } from '@/services/events/registration/auth'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { stripeCustomerOperations } from '@/services/stripeCustomers/operations'
import { EMPTY_VISIBILITY } from '@/auth/visibility/emptyVisibility'
import { Require } from '@/auth/authorizer/Require'
import { withFallback } from '@/app/ServerPage'
import type { ServerPageSession } from '@/app/ServerPage'
import type { DoubleLevelVisibilityMatrix } from '@/services/visibility/types'

export type EventRegistrationPageData = Awaited<ReturnType<typeof readEventRegistrationPageData>>

/**
 * What the registration on an event page needs to know of the one visiting - on Omega's event page
 * and on the career pages alike.
 */
export async function readEventRegistrationPageData(
    event: { id: number, takesRegistration: boolean, price: number | null },
    session: ServerPageSession,
) {
    // What the dots of the one visiting hold them back from - nothing to tell a visitor
    // without a user, and nothing to hide either, as it is their own dots it is read from.
    const dotPunishment = event.takesRegistration && session.user
        ? await eventRegistrationOperations.readDotPunishmentOfUser({
            params: { userId: session.user.id },
        })
        : null

    // The registration of the one visiting, if they are registered - the same holds as for
    // the dots.
    const ownRegistration = event.takesRegistration && session.user
        ? await eventRegistrationOperations.readOfUser({
            params: { eventId: event.id, userId: session.user.id },
        })
        : null

    // What paying for the event out of pocket would take: the visitor's balance, and a
    // Stripe customer session for saved payment methods. Only relevant when the event is
    // priced and the visitor can register at all.
    let eventPaymentBalance: number | undefined
    let eventPaymentCustomerSessionSecret: string | undefined

    if (event.takesRegistration && event.price && session.user) {
        eventPaymentBalance = (await ledgerAccountOperations.calculateBalance({
            params: { userId: session.user.id },
        })).amount

        const customerSession = await withFallback(
            stripeCustomerOperations.createSession({ params: { userId: session.user.id } }),
            null
        )
        eventPaymentCustomerSessionSecret = customerSession?.customerSessionClientSecret
    }

    return { dotPunishment, ownRegistration, eventPaymentBalance, eventPaymentCustomerSessionSecret }
}

/**
 * Whether the one visiting may register for the event, and register others for it - what the
 * registration on an event page is shown by.
 */
export function eventRegistrationCapabilities(
    data: { event: { published: boolean }, doubleLevelVisibility: DoubleLevelVisibilityMatrix | null },
    session: ServerPageSession,
) {
    return {
        canRegisterAsAdmin: eventRegistrationAuth.createAsAdmin.data({
            visibility: data.doubleLevelVisibility ?? EMPTY_VISIBILITY,
        }),
        // Registering takes the regular level of the event (its admin level while it is a draft),
        // for the session's own user.
        canRegister: session.user ? eventRegistrationAuth.create.data({
            userId: session.user.id,
            visibility: data.doubleLevelVisibility ?? EMPTY_VISIBILITY,
            published: data.event.published,
        }) : Require.user(),
    }
}
