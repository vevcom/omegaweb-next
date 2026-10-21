'use client'
import { companyListRenderer } from './CompanyListRenderer'
import { CompanyPagingContext } from '@/contexts/paging/CompanyPaging'
import EndlessScroll from '@/components/PagingWrappers/EndlessScroll'
import type { ReactNode } from 'react'

type PropTypes = {
    serverRenderedData: ReactNode,
    disableEditing?: boolean,
}

export default function CompanyList({ serverRenderedData, disableEditing }: PropTypes) {
    return (
        <div className="
            mt-6 grid grid-cols-[repeat(auto-fill,minmax(var(--company-card-min,200px),1fr))] items-stretch gap-6 w-full
        ">
            {serverRenderedData}
            <EndlessScroll
                pagingContext={CompanyPagingContext}
                loadingInfoClassName="col-span-full"
                renderer={companyListRenderer({ disableEditing })}
            />
        </div>
    )
}
