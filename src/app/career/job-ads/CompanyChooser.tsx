'use client'
import CompanyList from '@/components/Company/CompanyList'
import TextInput from '@/components/UI/TextInput'
import { CompanyPagingContext } from '@/contexts/paging/CompanyPaging'
import Link from 'next/link'
import { useContext } from 'react'
import type { ChangeEvent } from 'react'

type PropTypes = {
    className?: string
}

export default function CompanyChooser({ className }: PropTypes) {
    const companyPagingCtx = useContext(CompanyPagingContext)

    if (!companyPagingCtx) {
        throw new Error('CompanyPagingContext er ikke definert')
    }

    const handleNameFilter = (e: ChangeEvent<HTMLInputElement>) => {
        companyPagingCtx.setDetails({ name: e.target.value })
    }

    return (
        <div className={`flex flex-col min-h-0 gap-4 [--company-card-min:150px] ${className ?? ''}`}>
            <div className="flex flex-row flex-wrap items-center justify-between gap-2 shrink-0">
                <TextInput
                    className="flex-[1_1_12em] max-w-[20em] mt-0!"
                    label="Søk Navn"
                    name="name"
                    onChange={handleNameFilter}
                />
                <Link href="/career/companies" className="secondary-btn m-0 whitespace-nowrap">Administrer bedrifter</Link>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto pr-2 [&>div]:mt-0!">
                <CompanyList disableEditing serverRenderedData={[]} />
            </div>
        </div>
    )
}
