'use client'
import styles from './SchoolList.module.scss'
import { schoolListRenderer } from './SchoolListRenderer'
import EndlessScroll from '@/components/PagingWrappers/EndlessScroll'
import { SchoolPagingContext } from '@/contexts/paging/SchoolPaging'
import type { ReactNode } from 'react'

type PropTypes = {
    serverRendered: ReactNode
}

/**
 * WARNING: This component needs SchoolPagingContext to work properly
 * @param serverRendered - Make sure to pass the server rendered schools here in the correct format
 * You may use the schoolListRenderer to make sure of this
 * @returns
 */
export default function SchoolList({ serverRendered }: PropTypes) {
    return (
        <div className={styles.SchoolList}>
            {serverRendered}
            <EndlessScroll renderer={schoolListRenderer} pagingContext={SchoolPagingContext} />
        </div>
    )
}
