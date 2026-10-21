'use client'
import useOnNavigation from '@/hooks/useOnNavigation'
import React, { createContext, useState, useCallback } from 'react'

export type PopUpKeyType = number | string

type PopUpContextType = {
    teleport: (component: React.ReactNode, key: number | string) => void,
    remove: (key: PopUpKeyType) => void,
    keyOfCurrentNode: PopUpKeyType | undefined
        } | null

export const PopUpContext = createContext<PopUpContextType>(null)

/**
 * Whether a component is rendered inside an open pop-up. Only one pop-up is shown at a time, so
 * whatever would open another from there has to stay inside this one.
 */
export const InsidePopUpContext = createContext(false)

export default function PopUpProvider({ children }: { children: React.ReactNode }) {
    const [current, setCurrent] = useState<{ node: React.ReactNode, key: PopUpKeyType } | null>(null)
    useOnNavigation(() => setCurrent(null))

    const teleport = useCallback((component: React.ReactNode, key: PopUpKeyType) => {
        setCurrent({ node: component, key })
    }, [])

    // Compares against the state at the time of removal rather than at the last render, since it is
    // also called from cleanups and timeouts that hold on to an older render's context.
    const remove = useCallback((key: PopUpKeyType) => {
        setCurrent(open => (open?.key === key ? null : open))
    }, [])

    return (
        <PopUpContext.Provider value={{
            teleport,
            remove,
            keyOfCurrentNode: current?.key
        }}>
            {current?.node}
            {children}
        </PopUpContext.Provider>
    )
}

