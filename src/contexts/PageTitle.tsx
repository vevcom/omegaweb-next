'use client'

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'

export type PageTitle = {
    title: string
    subtitle?: string
}

type PageTitleContextType = PageTitle & {
    setTitle: (id: string, title: PageTitle) => void
    removeTitle: (id: string) => void
}

const PageTitleContext = createContext<PageTitleContextType | undefined>(undefined)

export function PageTitleProvider({ children }: { children: React.ReactNode }) {
    const [entries, setEntries] = useState<{ id: string, title: PageTitle }[]>([])

    const setTitle = useCallback((id: string, title: PageTitle) => setEntries(current => (
        current.some(entry => entry.id === id)
            ? current.map(entry => (entry.id === id ? { id, title } : entry))
            : [...current, { id, title }]
    )), [])
    const removeTitle = useCallback((id: string) => setEntries(
        current => current.filter(entry => entry.id !== id)
    ), [])

    const value = useMemo(() => ({
        ...(entries.at(-1)?.title ?? { title: '' }),
        setTitle,
        removeTitle,
    }), [entries, setTitle, removeTitle])

    return (
        <PageTitleContext.Provider value={value}>
            {children}
        </PageTitleContext.Provider>
    )
}

export function usePageTitle() {
    const ctx = useContext(PageTitleContext)
    if (!ctx) throw new Error('usePageTitle must be used within PageTitleProvider')
    return ctx
}
