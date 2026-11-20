'use client'
import { createContext, useState, type ReactNode } from 'react'
import type { Company } from '@/prisma-generated-pn-types'

/** What a selection knows of a company, which is what a form posts and shows of it. */
export type SelectableCompany = Pick<Company, 'id' | 'name'>

export const CompanySelectionContext = createContext<{
    selectedCompany: SelectableCompany | null,
    setSelectedCompany: (company: SelectableCompany | null) => void,
        } | null>(null)

type PropTypes = {
    children: ReactNode,
    company: SelectableCompany | null,
}

export default function CompanySelectionProvider({ children, company }: PropTypes) {
    const [selectedCompany, setSelectedCompany] = useState<SelectableCompany | null>(company)

    return (
        <CompanySelectionContext.Provider value={{
            selectedCompany,
            setSelectedCompany,
        }}>
            {children}
        </CompanySelectionContext.Provider>
    )
}
