'use client'
import { CompanySelectionContext } from '@/contexts/CompanySelection'
import { useContext } from 'react'

/**
 * Component for displaying the selected company in the CompanySelectionContext
 * @returns The selected company
 */
export default function SelectedCompany() {
    const companyCtx = useContext(CompanySelectionContext)

    if (!companyCtx) {
        throw new Error('CompanySelectionContext eller companyPaging er ikke definert')
    }

    const company = companyCtx.selectedCompany

    return (
        <div
            className={[
                'flex flex-col gap-1 w-full py-2 px-4 border-2 rounded-inner bg-surface-raised',
                company ? 'border-transparent' : 'border-[color-mix(in_srgb,var(--accent-yellow),transparent_60%)]',
            ].join(' ')}
        >
            <span className="text-[length:calc(var(--text-s)*0.85)] text-text-muted">Bedrift</span>
            <span className={`text-m leading-[calc(var(--text-m)*1.25)] truncate ${
                company ? 'text-ink-strong' : 'text-text-muted italic'
            }`}>{company ? company.name : 'Velg en bedrift i listen'}</span>
            {company && <input name="companyId" type="hidden" value={company.id} />}
        </div>
    )
}
