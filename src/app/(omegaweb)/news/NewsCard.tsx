import ImageCard from '@/components/ImageCard/ImageCard'
import { formatVevenUri } from '@/lib/urlEncoding'
import type { SimpleNewsArticle } from '@/services/news/types'

type PropTypes = {
    news: SimpleNewsArticle
}

export default function NewsCard({ news }: PropTypes) {
    return (
        <ImageCard
            href={`/news/${formatVevenUri(news.articleName, news.id)}`}
            title={news.articleName}
            image={news.coverImage}
        >
            <p>{news.description}</p>
        </ImageCard>
    )
}
