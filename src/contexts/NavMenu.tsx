'use client'
import { createContext, useContext, useState } from 'react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'

const NavMenuContext = createContext<{
    isOpen: boolean,
    setIsOpen: Dispatch<SetStateAction<boolean>>,
} | null>(null)

export function useNavMenu() {
    const navMenuCtx = useContext(NavMenuContext)
    if (!navMenuCtx) throw new Error('useNavMenu must be used within a NavMenuProvider')
    return navMenuCtx
}

export default function NavMenuProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <NavMenuContext.Provider value={{ isOpen, setIsOpen }}>
            {children}
        </NavMenuContext.Provider>
    )
}
