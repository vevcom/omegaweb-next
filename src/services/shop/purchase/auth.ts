import { Require } from '@/auth/authorizer/Require'
import { checkVisibility } from '@/auth/visibility/checkVisibility'
import { shopAuth } from '@/services/shop/shop/auth'
import type { MembershipFiltered } from '@/services/groups/types'
import type { DoubleLevelVisibilityMatrix } from '@/services/visibility/types'

/** The kiosk: a session allowed to charge other users for what they buy. */
const chargesOthers = Require.permission('PURCHASE_ADMIN')

export const purchaseAuth = {
    // Buying for yourself, in a shop you can see. Needs `{ userId, visibility }` via `.data()`.
    create: Require.allOf(Require.userId(), shopAuth.read),

    // The kiosk charges the owner of the card, so it is the owner, not the kiosk, who must be
    // allowed to buy in the shop: their memberships are held to the shop's regular level. Needs
    // `{ membershipsOfUser, visibility }` via `.data()`.
    createOnBehalf: chargesOthers.custom<{
        membershipsOfUser: MembershipFiltered[],
        visibility: DoubleLevelVisibilityMatrix,
    }>(
        ({ membershipsOfUser, visibility }) => checkVisibility(membershipsOfUser, visibility.regularLevel),
        { errorMessage: 'Eieren av kortet har ikke tilgang til butikken.' }
    ),

    // The permission alone: the card is resolved to its owner only after this has passed, so the
    // endpoint answers the same for known and unknown cards to anyone else. Whether the owner may
    // shop there is then `createOnBehalf`'s rule.
    createByStudentCard: chargesOthers,
} as const
