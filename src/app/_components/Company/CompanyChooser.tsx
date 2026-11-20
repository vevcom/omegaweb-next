'use client'
import CompanyList from '@/components/Company/CompanyList'
import TextInput from '@/components/UI/TextInput'
import { CompanySelectionContext } from '@/contexts/CompanySelection'
import { PopUpContext } from '@/contexts/PopUp'
import { CompanyPagingContext } from '@/contexts/paging/CompanyPaging'
import { careerLinks } from '@/app/(careers)/links'
import SiteLink from '@/components/SiteLink/SiteLink'
import { useContext } from 'react'
import type { ChangeEvent } from 'react'
import type { PopUpKeyType } from '@/contexts/PopUp'
import type { SelectableCompany } from '@/contexts/CompanySelection'

type PropTypes = {
    className?: string,
    /** The pop-up the chooser is shown in, which picking a company closes. */
    closePopUpOnPick?: PopUpKeyType,
}

export default function CompanyChooser({ className, closePopUpOnPick }: PropTypes) {
    const companyPagingCtx = useContext(CompanyPagingContext)
    const selection = useContext(CompanySelectionContext)
    const popUpCtx = useContext(PopUpContext)
    // A company is picked on its card, which knows nothing of a pop-up, so the pick is followed here.
    // The card takes a click on the company already picked as taking it away, which here only closes.
    const closingSelection = selection && closePopUpOnPick !== undefined ? {
        ...selection,
        setSelectedCompany: (company: SelectableCompany | null) => {
            if (company) selection.setSelectedCompany(company)
            popUpCtx?.remove(closePopUpOnPick)
        },
    } : selection

    if (!companyPagingCtx) {
        throw new Error('CompanyPagingContext er ikke definert')
    }

    const handleNameFilter = (e: ChangeEvent<HTMLInputElement>) => {
        companyPagingCtx.setDetails({ name: e.target.value })
    }

    return (
        <div className={`
            flex flex-col min-h-0 gap-4 [--company-card-min:150px]
            ${className ?? ''}
        `}>
            <div className="flex flex-row flex-wrap items-center justify-between gap-2 shrink-0">
                <TextInput
                    className="flex-[1_1_12em] max-w-[20em] mt-0!"
                    label="Søk etter navn"
                    onChange={handleNameFilter}
                />
                <SiteLink href={careerLinks.companies()} className="btn-neutral m-0 whitespace-nowrap">
                    Administrer bedrifter
                </SiteLink>
            </div>
            <div className="
                flex-1 min-h-0 overflow-y-auto pr-2
                [&>div]:mt-0!
            ">
                <CompanySelectionContext.Provider value={closingSelection}>
                    <CompanyList disableEditing serverRenderedData={[]} />
                </CompanySelectionContext.Provider>
            </div>
        </div>
    )
}
