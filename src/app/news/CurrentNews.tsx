import NewsCard from './NewsCard'
import { newsOperations } from '@/services/news/operations'
import { withPageSession } from '@/app/serverPage'
import React from 'react'

type PropTypes = {
    not?: number
}

/**
 * @param not - pass it not: a id of a news to exclude from the list
 * WARNING: This component must be server-side rendered
 */
export default async function CurrentNews({ not }: PropTypes) {
    const currentNews = await withPageSession(() => newsOperations.readCurrent({}))
    const news = currentNews.filter(newsItem => newsItem.id !== not)

    return (
        news.length ? (
            news.map(newsItem => <NewsCard key={newsItem.id} news={newsItem} />)
        ) : (
            <i>Det er for tiden ingen nyheter</i>
        )
    )
}
