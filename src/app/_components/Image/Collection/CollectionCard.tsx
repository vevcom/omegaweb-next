import Image from '@/components/Image/Image'
import type { ExpandedImageCollection } from '@/services/images/subservice/types'

type PropTypes = {
    collection: ExpandedImageCollection,
    className?: string,
}

const surfaceGradient = 'after:bg-[linear-gradient(to_bottom,transparent_55%,var(--surface-base))]'
const specialGradient = 'after:bg-[linear-gradient(to_bottom,transparent_55%,var(--accent-magenta))]'

export default function CollectionCard({ collection, className }: PropTypes) {
    return (
        <div className={`
            group round relative block place-self-center w-full h-full m-2 overflow-hidden
            [&>*:first-child]:absolute [&>*:first-child]:top-0 [&>*:first-child]:left-0 [&>*:first-child]:w-full
            [&>*:first-child]:h-full
            [&>*:first-child>img]:absolute [&>*:first-child>img]:top-0 [&>*:first-child>img]:left-0
            [&>*:first-child>img]:w-full [&>*:first-child>img]:h-full [&>*:first-child>img]:object-cover
            [&>*:first-child>img]:transition-[scale] [&>*:first-child>img]:duration-500
            hover:[&_img]:scale-120
            after:absolute after:top-0 after:left-0 after:w-full after:h-full after:z-0
            ${collection.special ? specialGradient : surfaceGradient}
            ${className ?? ''}
        `}>
            {
                collection.coverImage ? (
                    <Image width={100} sizes="350px" image={collection.coverImage} />
                ) : (
                    <p>Noe gikk galt</p>
                )
            }
            {collection.special && <p className="
                absolute top-0 left-0 z-1 p-[0.3em] text-center text-[0.8em] tracking-[0.05em] uppercase text-white
                bg-accent-magenta rounded-[0_0_1em_0]
            ">Spesiell</p>}
            <div className="
                absolute bottom-0 left-0 z-1 w-full p-2 no-underline text-text transition-[min-height] duration-500
                [&_i]:mt-2 [&_i]:transition-opacity [&_i]:duration-500 [&_i]:text-ellipsis [&_i]:whitespace-nowrap
            ">
                <h2>{collection.name}</h2>
                <i>{collection.description}</i>
                <p>{collection.createdAt.toUTCString().split(' ').slice(0, 4).join(' ')}</p>
            </div>
            <p className="
                absolute top-0 right-0 z-1 p-[0.3em] min-w-[30px] text-center text-text bg-surface-raised
                rounded-[0_0_0_1em]
            ">{collection.numberOfImages}</p>
        </div>
    )
}
