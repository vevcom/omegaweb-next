'use client'
import CompanyChooser from './CompanyChooser'
import Button from '@/components/UI/Button'
import PopUp from '@/components/PopUp/PopUp'
import { useFormReset, useInputEvent } from '@/components/Form/JsonFieldInput'
import { CompanySelectionContext } from '@/contexts/CompanySelection'
import { CompanyPagingProvider } from '@/contexts/paging/CompanyPaging'
import { useContext, useId, useRef, useState } from 'react'
import type { CompanyExpanded } from '@/services/careers/companies/types'

type PropTypes = {
    /** Whether the company may be left out. None is then posted as 'NULL', which clears it. */
    optional?: boolean,
    /** Whether the companies are chosen among in a pop-up opened from here, rather than in a list beside it. */
    chooseInPopUp?: boolean,
}

// Kept out of the component, since the paging provider starts the list over when it is given new ones.
const noCompanies: CompanyExpanded[] = []
const firstPage = { page: 0, pageSize: 10 } as const
const allCompanies = { name: undefined }

/** The company picked in the CompanySelectionContext, as a field of a form that posts it as `companyId`. */
export default function SelectedCompany({ optional = false, chooseInPopUp = false }: PropTypes) {
    const companyCtx = useContext(CompanySelectionContext)
    const popUpKey = useId()
    const company = companyCtx?.selectedCompany ?? null
    const value = company ? String(company.id) : 'NULL'
    const [startedWith] = useState(company)
    const inputRef = useRef<HTMLInputElement>(null)
    useInputEvent(inputRef, value)
    useFormReset(inputRef, () => companyCtx?.setSelectedCompany(startedWith))

    if (!companyCtx) {
        throw new Error('CompanySelectionContext er ikke definert')
    }

    const missing = !company && !optional

    return (
        <div
            className={`
                flex flex-col gap-1 w-full py-2 px-4 border-2 rounded-inner bg-base-200
                ${missing ? 'border-[color-mix(in_srgb,var(--color-warning),transparent_60%)]' : 'border-transparent'}
            `}
        >
            <span className="text-[length:calc(var(--text-s)*0.85)] text-base-content/80">Bedrift</span>
            <span className={`
                text-m leading-[calc(var(--text-m)*1.25)] truncate
                ${
        company ? 'text-base-content' : 'text-base-content/80 italic'
        }
            `}>{company?.name ?? (optional ? 'Ingen bedrift' : 'Velg en bedrift i listen')}</span>
            {(chooseInPopUp || (optional && company)) && <div className="flex gap-4">
                {chooseInPopUp && <PopUp
                    popUpKey={popUpKey}
                    customShowButton={open => (
                        <Button type="button" variant="text" onClick={open}>{company ? 'Bytt' : 'Velg bedrift'}</Button>
                    )}
                >
                    <CompanyPagingProvider
                        serverRenderedData={noCompanies}
                        startPage={firstPage}
                        details={allCompanies}
                    >
                        <CompanyChooser closePopUpOnPick={popUpKey} className="w-[min(80vw,60rem)] h-[70svh]" />
                    </CompanyPagingProvider>
                </PopUp>}
                {optional && company && (
                    <Button type="button" variant="text" onClick={() => companyCtx.setSelectedCompany(null)}>
                        Fjern
                    </Button>
                )}
            </div>}
            {/* Rendered from the start, so that `useFormReset` finds its form; disabled, it posts nothing. */}
            <input ref={inputRef} name="companyId" type="hidden" value={value} disabled={missing} />
        </div>
    )
}
