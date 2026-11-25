import { Require } from '@/auth/authorizer/Require'
import { canSeeEvent, eventAdminLevel } from '@/services/events/auth'

const guestOfEvent = Require.allOf(Require.user(), canSeeEvent)

export const eventSeatingAuth = {
    readBoard: eventAdminLevel,
    openWishes: eventAdminLevel,
    savePlan: eventAdminLevel,
    setPublished: eventAdminLevel,

    // Who is registered is already shown to the same people. See eventRegistrationAuth.readPage.
    readOwn: guestOfEvent,
    updateWishes: guestOfEvent,
} as const
