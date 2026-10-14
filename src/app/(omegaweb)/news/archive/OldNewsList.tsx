'use client'
import styles from './OldNewsList.module.scss'
import EndlessScroll from '@/components/PagingWrappers/EndlessScroll'
import { OldNewsPagingContext } from '@/contexts/paging/OldNewsPaging'
import NewsCard from '@/app/(omegaweb)/news/NewsCard'
import type { ReactNode } from 'react'

type PropTypes = {
    serverRendered: ReactNode
}

export default function OldNewsList({ serverRendered }: PropTypes) {
    return (
        <div className={styles.OldNewsList}>
            { serverRendered }
            <EndlessScroll
                pagingContext={OldNewsPagingContext}
                renderer={news => (
                    <NewsCard news={news} />
                )}
            />
        </div>
    )
}
