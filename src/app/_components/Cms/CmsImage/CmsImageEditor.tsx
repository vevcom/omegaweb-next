'use client'
import styles from './CmsImageEditor.module.scss'
import ChangeImage from './ChangeImage'
import ChangeImageForm from './ChangeImageForm'
import EditOverlay from '@/cms/EditOverlay'
import PopUp from '@/components/PopUp/PopUp'
import EndlessScroll from '@/components/PagingWrappers/EndlessScroll'
import CollectionCard from '@/components/Image/Collection/CollectionCard'
import ImagePanel from '@/components/Image/ImagePanel/ImagePanel'
import {
    DynamicImageCollectionPagingProvider,
    DynamicImageCollectionPagingContext
} from '@/contexts/paging/DynamicImageCollectionPaging'
import useEditMode from '@/hooks/useEditMode'
import PopUpProvider from '@/contexts/PopUp'
import { useSpecialCollections } from '@/contexts/ClientData'
import { specialImagePanels } from '@/services/images/specialPanels/constants'
import { readImagesPageInDynamicCollectionAction } from '@/services/images/dynamic/actions'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faInfo } from '@fortawesome/free-solid-svg-icons'
import type { ReadPageOfImagesInCollectionAction } from '@/components/Image/ImagePanel/ImagePanel'
import type { ExpandedImageCollection } from '@/services/images/subservice/types'
import type { CmsImage } from '@/prisma-generated-pn-types'
import type { ExpandedImage } from '@/services/images/subservice/types'
import type { UpdateCmsImageAction } from '@/cms/images/types'
import type { CapabilitiesJsObject } from '@/auth/authorizer/capabilities'

const collectionPagingDetails = { showOnlyCollectionsSessionAdministrates: true } as const
const imagePageSize = 30

type PropTypes = {
    cmsImage: CmsImage & {
        image: ExpandedImage | null
    },
    updateCmsImageAction: UpdateCmsImageAction
    capabilities: CapabilitiesJsObject<'canEdit'>
}

/**
 * A component to edit a cms image. If cmsImage.image is null the user is choosing an image for
 * the slot for the first time - no collection is pre-selected until they pick one.
 * @param cmsImage - the cms image to edit
 * @returns
 */
export default function CmsImageEditor({ cmsImage, updateCmsImageAction, capabilities }: PropTypes) {
    const editable = useEditMode({ authResult: capabilities.canEdit })
    const [currentCollectionId, setCurrentCollectionId] = useState<number | null>(
        cmsImage.image?.collectionId ?? null
    )
    const [selectedImage, setSelectedImage] = useState<ExpandedImage | null>(cmsImage.image)

    const specialCollectionsResult = useSpecialCollections()

    // The pager for the chosen collection, one stable identity per collection - the panel resets
    // and refetches when it changes. Special collections cannot be paged through the dynamic
    // action (it refuses them by ownership), so ids matching a special collection get that
    // service's own pager instead. Until the special collections have loaded such an id would
    // briefly resolve to the dynamic pager and error - the recompute on load corrects it.
    const readPageOfImagesInCollectionAction = useMemo(
        (): ReadPageOfImagesInCollectionAction<typeof imagePageSize> | null => {
            if (currentCollectionId === null) return null
            const specialCollections = specialCollectionsResult.status === 'success'
                ? specialCollectionsResult.specialCollections
                : []
            const special = specialCollections.find(
                collection => collection.id === currentCollectionId
            )?.special
            if (special) {
                const readPageAction = specialImagePanels[special].readPageOfImagesInCollectionAction
                return page => readPageAction({ params: { paging: { page } } })
            }
            return page => readImagesPageInDynamicCollectionAction({
                params: {
                    paging: { page },
                    collectionId: currentCollectionId,
                },
            })
        },
        [currentCollectionId, specialCollectionsResult]
    )

    const isCollectionActive = (collection: { id: number }) => (
        collection.id === currentCollectionId ? styles.selected : ''
    )

    const renderCollection = (collection: ExpandedImageCollection) => (
        <div
            key={collection.id}
            className={`${styles.collection} ${isCollectionActive(collection)}`}
        >
            <button
                onClick={() => setCurrentCollectionId(collection.id)}
                className={styles.selector}
            />
            <CollectionCard
                className={styles.collectionCard}
                collection={collection}
            />
        </div>
    )

    const renderSpecialCollections = () => {
        if (specialCollectionsResult.status === 'loading') return <i>Laster inn...</i>
        if (specialCollectionsResult.status === 'error') return <p>Noe gikk galt</p>
        return specialCollectionsResult.specialCollections.map(renderCollection)
    }

    const hasNewSelection = selectedImage !== null && selectedImage.id !== cmsImage.image?.id

    if (!editable) return null
    return (
        <PopUp
            popUpKey={`EditCmsImage${cmsImage.id}`}
            showButtonContent={<EditOverlay />}
            showButtonClass={styles.showBtn}
        >
            <PopUpProvider>
                <div className={styles.CmsImageEditor}>
                    <div className={styles.currentCmsImage}>
                        <div className={styles.info}>
                            <h2>Edit image link</h2>
                            <div className={styles.meta}>
                                <p>name: {cmsImage.name}</p>
                                <i>id: {cmsImage.id}</i>
                            </div>
                        </div>
                        <ChangeImage
                            currentImage={cmsImage.image}
                            selectedImage={selectedImage}
                            cmsImageId={cmsImage.id}
                            updateCmsImageAction={updateCmsImageAction}
                        />
                    </div>
                    {hasNewSelection && selectedImage && (
                        <ChangeImageForm
                            className={styles.changeImageMobile}
                            cmsImageId={cmsImage.id}
                            selectedImage={selectedImage}
                            updateCmsImageAction={updateCmsImageAction}
                        />
                    )}
                    <div className={styles.selectImage}>
                        {readPageOfImagesInCollectionAction ? (
                            <ImagePanel
                                readPageOfImagesInCollectionAction={readPageOfImagesInCollectionAction}
                                pageSize={imagePageSize}
                                selectionActive
                                onSelectedImageChange={setSelectedImage}
                                defaultSelectedImage={cmsImage.image ?? undefined}
                            />
                        ) : (
                            <p>Velg en samling for å se bildene i den</p>
                        )}
                    </div>
                    <div className={styles.selectCollection}>
                        <p className={styles.collectionNote}>
                            <FontAwesomeIcon icon={faInfo} />
                            <span>
                                Du ser bare bildesamlingene du administrerer. Merk at bildet du
                                velger blir synlig for alle som kan se siden det brukes på - også
                                for de som ikke har tilgang til samlingen bildet ligger i.
                            </span>
                        </p>
                        <div className={styles.collections}>
                            {renderSpecialCollections()}
                            <DynamicImageCollectionPagingProvider
                                startPage={{
                                    pageSize: 12,
                                    page: 0,
                                }}
                                details={collectionPagingDetails}
                                serverRenderedData={[]}
                            >
                                <EndlessScroll
                                    pagingContext={DynamicImageCollectionPagingContext}
                                    renderer={renderCollection}
                                />
                            </DynamicImageCollectionPagingProvider>
                        </div>
                    </div>
                    <Link className={styles.linkToImages} href="/image-collections/">
                        Gå til bilder
                    </Link>
                </div>
            </PopUpProvider>
        </PopUp>
    )
}
