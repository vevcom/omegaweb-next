'use client'
import ImagePanel from '@/components/Image/ImagePanel/ImagePanel'
import { specialImagePanels } from '@/components/Image/ImagePanel/specialImagePanels'
import { useCallback } from 'react'
import type { ImagePanelCursor } from '@/components/Image/ImagePanel/ImagePanel'
import type { Page } from '@/lib/paging/types'
import type { SpecialCollection } from '@/prisma-generated-pn-types'

const pageSize = 30

type PropTypes = {
    special: SpecialCollection,
}

/**
 * The client bridge between the server rendered special collection page and the ImagePanel: binds
 * the special collection into its own service's pager with a stable identity. Special collections
 * are browsed only - no selection and no administration here.
 */
export default function SpecialCollectionPanel({ special }: PropTypes) {
    const readPageOfImagesInCollectionAction = useCallback(
        (page: Page<typeof pageSize, ImagePanelCursor>) =>
            specialImagePanels[special].readPageOfImagesInCollectionAction({ params: { paging: { page } } }),
        [special]
    )

    return (
        <ImagePanel
            readPageOfImagesInCollectionAction={readPageOfImagesInCollectionAction}
            pageSize={pageSize}
            withImageDisplay
        />
    )
}
