'use client'

import { createContext, useState } from 'react'
import type { ReactNode } from 'react'
import type { UserBasic } from '@/services/users/types'

type PropTypes = {
    children: ReactNode
}

/**
 * Context designed to be used with UserPagingContext and UserList.
 * If UserList is rendered inside UsersSelectionProvider, it will display a checkbox next to each user.
 * Users are matched by id, since paging hands out a new object for a user every time it refetches.
 */
export const UsersSelectionContext = createContext<{
    users: UserBasic[]
    addUser: (user: UserBasic) => void
    removeUser: (user: UserBasic) => void
    toggle: (user: UserBasic) => void
    includes: (user: UserBasic) => boolean
        } | null>(null)

function containsUser(users: UserBasic[], user: UserBasic) {
    return users.some(selectedUser => selectedUser.id === user.id)
}

export default function UsersSelectionProvider({ children }: PropTypes) {
    const [users, setUsers] = useState<UserBasic[]>([])

    const addUser = (user: UserBasic) => {
        setUsers(previousUsers => (containsUser(previousUsers, user) ? previousUsers : [...previousUsers, user]))
    }
    const removeUser = (user: UserBasic) => {
        setUsers(previousUsers => previousUsers.filter(selectedUser => selectedUser.id !== user.id))
    }
    const includes = (user: UserBasic) => containsUser(users, user)
    const toggle = (user: UserBasic) => {
        if (includes(user)) {
            removeUser(user)
        } else {
            addUser(user)
        }
    }

    return <UsersSelectionContext.Provider value={{ users, addUser, removeUser, toggle, includes }}>
        {children}
    </UsersSelectionContext.Provider>
}
