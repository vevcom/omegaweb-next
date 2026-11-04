import CollectionCard from './CollectionCard'
import SiteLink from '@/components/SiteLink/SiteLink'
import { appHref } from '@/lib/sites/href'
import type { ExpandedImageCollection } from '@/services/images/subservice/types'
import type { AppHref } from '@/lib/sites/href'

type PropTypes = {
    collection: ExpandedImageCollection,
    className?: string,
}

function collectionHref(collection: ExpandedImageCollection): AppHref {
    return appHref(collection.special
        ? `/image-collections/special/${encodeURIComponent(collection.special)}`
        : `/image-collections/dynamic/${encodeURIComponent(collection.name)}`)
}

/**
 * A CollectionCard that navigates to the collection on click - for listing pages. CmsImageEditor
 * does not navigate on click, so it wraps the plain CollectionCard itself instead of using this.
 * The className, if given, sizes the link (the actual grid item) - CollectionCard fills it.
 */
export default function CollectionCardLink({ collection, className }: PropTypes) {
    return (
        <SiteLink href={collectionHref(collection)} className={className}>
            <CollectionCard collection={collection} />
        </SiteLink>
    )
}
