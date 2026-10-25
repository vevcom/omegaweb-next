'use client'

import UserList from '@/components/User/UserList/UserList'

/**
 * A user search that leads to the user's membership status rather than their profile, so that an
 * admission trial or a membership can be seen to from here.
 */
export default function MembershipStatusUserSearch() {
    return <UserList linksToUser userHref={user => `/users/${user.username}/membership-status`} />
}
