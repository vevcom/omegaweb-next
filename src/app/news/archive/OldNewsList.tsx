'use client'
import EndlessScroll from '@/components/PagingWrappers/EndlessScroll'
import { OldNewsPagingContext } from '@/contexts/paging/OldNewsPaging'
import NewsCard from '@/app/news/NewsCard'
import type { ReactNode } from 'react'

type PropTypes = {
    serverRendered: ReactNode
}

export default function OldNewsList({ serverRendered }: PropTypes) {
    return (
        <div className="image-card-list">
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
