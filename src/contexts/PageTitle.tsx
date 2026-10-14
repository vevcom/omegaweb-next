'use client'

import React, { createContext, useContext, useState } from 'react'

export type PageTitle = {
    title: string
    subtitle?: string
}

type PageTitleContextType = PageTitle & {
    setTitle: (title: PageTitle) => void
}

const PageTitleContext = createContext<PageTitleContextType | undefined>(undefined)

export function PageTitleProvider({ children }: { children: React.ReactNode }) {
    const [pageTitle, setTitle] = useState<PageTitle>({ title: '' })
    return (
        <PageTitleContext.Provider value={{ ...pageTitle, setTitle }}>
            {children}
        </PageTitleContext.Provider>
    )
}

export function usePageTitle() {
    const ctx = useContext(PageTitleContext)
    if (!ctx) throw new Error('usePageTitle must be used within PageTitleProvider')
    return ctx
}
