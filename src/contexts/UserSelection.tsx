'use client'
import { createContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { UserBasic } from '@/services/users/types'

type PropTypes = {
    children: ReactNode
    initialUser?: UserBasic | null
}

/**
 * Context designed to be used with UserPagingContext and UserList.
 * If UserList is rendered inside IserSelectionProvider, it will display a checkbox next to each user.
 */
export const UserSelectionContext = createContext<{
    user: UserBasic | null
    setUser: (user: UserBasic | null) => void
    onSelection: (handler: (user: UserBasic | null) => void) => void
        } | null>(null)

type Handler = (user: UserBasic | null) => void

export default function UserSelectionProvider({ children, initialUser }: PropTypes) {
    const [user, setUser] = useState<UserBasic | null>(initialUser ? initialUser : null)
    const onSelection = useRef<Handler>(() => {})
    useEffect(() => {
        onSelection.current(user)
    }, [user])

    return <UserSelectionContext.Provider value={{
        user,
        setUser,
        onSelection: (handler: Handler) => {
            onSelection.current = handler
        }
    }}>
        {children}
    </UserSelectionContext.Provider>
}
