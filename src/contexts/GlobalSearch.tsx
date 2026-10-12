'use client'
import { createContext, useContext, useState } from 'react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'

type PropTypes = {
    children: ReactNode,
}

/**
 * Holds whether the global search popup is open, so that it can be opened from
 * elsewhere in the app (e.g. the search button in the nav bar) and not only by
 * the keyboard shortcut GlobalSearch itself listens for.
 */
export const GlobalSearchContext = createContext<{
    isOpen: boolean,
    setIsOpen: Dispatch<SetStateAction<boolean>>,
} | null>(null)

export function useGlobalSearch() {
    const globalSearchCtx = useContext(GlobalSearchContext)
    if (!globalSearchCtx) throw new Error('useGlobalSearch must be used within a GlobalSearchProvider')
    return globalSearchCtx
}

export default function GlobalSearchProvider({ children }: PropTypes) {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <GlobalSearchContext.Provider value={{ isOpen, setIsOpen }}>
            {children}
        </GlobalSearchContext.Provider>
    )
}
