import ImageCard from '@/components/ImageCard/ImageCard'
import { omegaLinks } from '@/app/(omegaweb)/links'
import type { SimpleNewsArticle } from '@/services/news/types'

type PropTypes = {
    news: SimpleNewsArticle
}

export default function NewsCard({ news }: PropTypes) {
    return (
        <ImageCard
            href={omegaLinks.news(news)}
            title={news.articleName}
            image={news.coverImage}
        >
            <p>{news.description}</p>
        </ImageCard>
    )
}
