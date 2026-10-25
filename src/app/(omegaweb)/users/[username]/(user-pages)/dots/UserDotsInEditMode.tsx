'use client'
import UserDots from '@/components/Dot/UserDots'
import useEditMode from '@/hooks/useEditMode'
import { useSession } from '@/auth/session/useSession'
import { dotAuth } from '@/services/dots/auth'
import type { DotExpanded } from '@/services/dots/types'

type PropTypes = {
    userId: number,
    dots: DotExpanded[],
}

/**
 * The dots of a user on their profile. The crud of dots is administration of the user rather than
 * part of their profile, so it is only offered to an authorized user that is in edit mode.
 *
 * @param userId - The user the dots belong to.
 * @param dots - The dots of the user, in ascending order of expiry.
 */
export default function UserDotsInEditMode({ userId, dots }: PropTypes) {
    const session = useSession()
    const sessionUser = session.loading ? null : session.session.user

    const editCreate = useEditMode({
        authorizer: dotAuth.create.data({ userId: sessionUser?.id ?? 0 })
    })
    const editUpdate = useEditMode({ authorizer: dotAuth.update })
    const editDestroy = useEditMode({ authorizer: dotAuth.destroy })

    return (
        <UserDots
            userId={userId}
            dots={dots}
            showCreateForm={editCreate}
            showUpdateForm={editUpdate}
            showDestroyForm={editDestroy}
        />
    )
}
