import { Require } from '@/auth/authorizer/Require'
import { checkVisibility } from '@/auth/visibility/checkVisibility'
import { shopAuth } from '@/services/shop/shop/auth'
import type { MembershipFiltered } from '@/services/groups/types'
import type { DoubleLevelVisibilityMatrix } from '@/services/visibility/types'

export const purchaseAuth = {
    // Buying for yourself, in a shop you can see. Needs `{ userId, visibility }` via `.data()`.
    create: Require.allOf(Require.userId(), shopAuth.read),

    // The kiosk charges the owner of the card, so it is the owner, not the kiosk, who must be
    // allowed to buy in the shop: their memberships are held to the shop's regular level.
    createByStudentCard: Require.permission('PURCHASE_ADMIN').custom<{
        membershipsOfUser: MembershipFiltered[],
        visibility: DoubleLevelVisibilityMatrix,
    }>(
        ({ membershipsOfUser, visibility }) => checkVisibility(membershipsOfUser, visibility.regularLevel),
        { errorMessage: 'Eieren av kortet har ikke tilgang til butikken.' }
    ),
} as const
