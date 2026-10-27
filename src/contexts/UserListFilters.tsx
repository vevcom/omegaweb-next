'use client'

import { createContext, useState } from 'react'
import type { ReactNode } from 'react'

type PropTypes = {
    children: ReactNode
}

/**
 * Whether UserList's filters are open on mobile, and how many are active. A page provides it to show
 * the filter toggle in its PageWrapper header instead of in its own row above the list.
 */
export const UserListFiltersContext = createContext<{
    open: boolean,
    setOpen: (open: boolean) => void,
    activeCount: number,
    setActiveCount: (count: number) => void,
        } | null>(null)

export default function UserListFiltersProvider({ children }: PropTypes) {
    const [open, setOpen] = useState(false)
    const [activeCount, setActiveCount] = useState(0)

    return (
        <UserListFiltersContext.Provider value={{ open, setOpen, activeCount, setActiveCount }}>
            {children}
        </UserListFiltersContext.Provider>
    )
}
