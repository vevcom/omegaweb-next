'use client'
import { companyListRenderer } from './CompanyListRenderer'
import styles from './CompanyList.module.scss'
import { CompanyPagingContext } from '@/contexts/paging/CompanyPaging'
import EndlessScroll from '@/components/PagingWrappers/EndlessScroll'
import type { ReactNode } from 'react'

type PropTypes = {
    serverRenderedData: ReactNode,
    disableEditing?: boolean,
}

export default function CompanyList({ serverRenderedData, disableEditing }: PropTypes) {
    return (
        <div className={styles.CompanyList}>
            {serverRenderedData}
            <EndlessScroll
                pagingContext={CompanyPagingContext}
                loadingInfoClassName={styles.loadingControl}
                renderer={companyListRenderer({ disableEditing })}
            />
        </div>
    )
}
