'use client'
import styles from './page.module.scss'
import CollectionAdmin from './CollectionAdmin'
import PageTitleSetter from '@/contexts/PageTitleSetter'
import ImagePanel from '@/components/Image/ImagePanel/ImagePanel'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import DoubleLevelVisibilityDescription
    from '@/components/Visibility/DoubleLevelVisibilityDescription/DoubleLevelVisibilityDescription'
import { readImagesPageInDynamicCollectionAction } from '@/services/images/dynamic/actions'
import { useCallback, useState } from 'react'
import type { ImagePanelCursor } from '@/components/Image/ImagePanel/ImagePanel'
import type { Page } from '@/lib/paging/types'
import type { ExpandedImageCollection } from '@/services/images/subservice/types'
import type { DoubleLevelVisibilityMatrix } from '@/services/visibility/types'

const pageSize = 30

type PropTypes = {
    collection: ExpandedImageCollection,
    doubleLevelVisibility: DoubleLevelVisibilityMatrix | null,
}

/**
 * The client bridge between the server rendered collection page and the ImagePanel: binds the
 * collection into the dynamic pager (a lambda the server page cannot create itself) with a stable
 * identity per collection. Uploads remount the panel through its key, since new images invalidate
 * every loaded page.
 *
 * It owns the PageWrapper rather than the server page because the admin controls live in the
 * wrapper's header slot while the panel they refresh lives in its body - the two slots have to sit
 * inside the same client component to share the refresh callback.
 */
export default function DynamicCollectionPanel({ collection, doubleLevelVisibility }: PropTypes) {
    const [panelGeneration, setPanelGeneration] = useState(0)

    const readPageOfImagesInCollectionAction = useCallback(
        (page: Page<typeof pageSize, ImagePanelCursor>) =>
            readImagesPageInDynamicCollectionAction({
                params: {
                    paging: { page },
                    collectionId: collection.id,
                },
            }),
        [collection.id]
    )

    return (
        <PageWrapper
            headerItem={
                <CollectionAdmin
                    collection={collection}
                    doubleLevelVisibility={doubleLevelVisibility}
                    refreshImages={() => setPanelGeneration(generation => generation + 1)}
                />
            }
        >
            <PageTitleSetter title={collection.name} />
            <div className={styles.collectionHeader}>
                {collection.description && <p className={styles.description}>{collection.description}</p>}
                {doubleLevelVisibility && (
                    <DoubleLevelVisibilityDescription doubleLevelVisibility={doubleLevelVisibility} />
                )}
            </div>
            <main>
                <ImagePanel
                    key={panelGeneration}
                    readPageOfImagesInCollectionAction={readPageOfImagesInCollectionAction}
                    pageSize={pageSize}
                    withImageDisplay
                />
            </main>
        </PageWrapper>
    )
}
