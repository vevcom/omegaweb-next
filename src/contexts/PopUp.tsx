'use client'
import useOnNavigation from '@/hooks/useOnNavigation'
import React, { createContext, useState, useCallback, useMemo } from 'react'

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

    // Kept while the same pop-up is open. A pop-up teleports itself again whenever what it shows
    // changes, so a value made anew there would render whoever holds the context and teleport again.
    const keyOfCurrentNode = current?.key
    const value = useMemo(() => ({ teleport, remove, keyOfCurrentNode }), [teleport, remove, keyOfCurrentNode])

    return (
        <PopUpContext.Provider value={value}>
            {current?.node}
            {children}
        </PopUpContext.Provider>
    )
}

