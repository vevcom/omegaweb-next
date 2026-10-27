'use client'
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
import { specialImagePanels } from '@/components/Image/ImagePanel/specialImagePanels'
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
        collection.id === currentCollectionId
            ? 'scale-110 z-3 border-5 border-accent-blue rounded-[1.25em] [&_img]:scale-120'
            : ''
    )

    const renderCollection = (collection: ExpandedImageCollection) => (
        <div
            key={collection.id}
            data-collection
            className={`
                relative shrink-0 mx-[.2em] size-[calc(14vmin+70px)]
                [&>*:last-child]:m-0 [&>*:last-child]:z-1
                ${
        isCollectionActive(collection)
        }
            `}
        >
            <button
                onClick={() => setCurrentCollectionId(collection.id)}
                className="
                    peer w-full h-full z-2 absolute bg-transparent text-transparent border-none
                    hover:cursor-pointer
                "
            />
            <CollectionCard
                className="
                    [&_img]:-z-1
                    peer-hover:[&_img]:scale-120
                "
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
        <PopUp title="Endre bilde"
            popUpKey={`EditCmsImage${cmsImage.id}`}
            showButtonContent={<EditOverlay />}
            showButtonClass="w-full h-full absolute top-0 left-0 border-none bg-transparent"
        >
            <PopUpProvider>
                <div className="
                    grid
                    mobile:w-[calc(97vw-140px)] mobile:h-[calc(97vh-140px)] mobile:grid-cols-[auto_1fr]
                    mobile:grid-rows-[1fr_auto] mobile:gap-[1em]
                    max-mobile:w-full max-mobile:grid-cols-1 max-mobile:grid-rows-[1fr_auto_auto] max-mobile:h-[75svh]
                    max-mobile:overflow-y-hidden
                ">
                    <div className="
                        layer rounded-round p-2 col-[1/2] row-[1/2]
                        max-mobile:hidden
                    ">
                        <div className="max-w-[150px] overflow-hidden">
                            <div>
                                <p>Navn: {cmsImage.name}</p>
                                <i>ID: {cmsImage.id}</i>
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
                            className="
                                row-[3/4]
                                mobile:hidden
                            "
                            cmsImageId={cmsImage.id}
                            selectedImage={selectedImage}
                            updateCmsImageAction={updateCmsImageAction}
                        />
                    )}
                    <div className="
                        col-[2/3] row-[1/2] bg-surface-base overflow-scroll max-w-full w-full round
                        [&>*]:isolate
                        max-mobile:col-[1/2] max-mobile:my-[1em] max-mobile:mx-0
                    ">
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
                    <div className="col-[1/3] row-[2/3] layer flex flex-col max-w-full p-4 rounded-round">
                        <p className="
                            flex items-start gap-2 mb-2 max-w-[90ch] text-s text-text-muted
                            [&>svg]:mt-[0.25em] [&>svg]:shrink-0
                        ">
                            <FontAwesomeIcon icon={faInfo} />
                            <span>
                                Du ser bare bildesamlingene du administrerer. Merk at bildet du
                                velger blir synlig for alle som kan se siden det brukes på - også
                                for de som ikke har tilgang til samlingen bildet ligger i.
                            </span>
                        </p>
                        <div className="
                            flex max-w-full overflow-x-scroll min-h-[calc(14vmin+70px+5vmin)] items-center
                            [&>*:last-child:not([data-collection])]:min-w-[calc(14vmin+70px)]
                            [&>*:last-child:not([data-collection])]:h-[calc(14vmin+70px)]
                            [&>*:last-child:not([data-collection])]:border
                            [&>*:last-child:not([data-collection])]:border-surface-subtle
                            [&>*:last-child:not([data-collection])]:flex [&>*:last-child:not([data-collection])]:relative
                            [&>*:last-child:not([data-collection])]:round
                        ">
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
                    <Link
                        className="
                            absolute w-[10em] btn
                            mobile:-top-[2%] mobile:-right-[2%]
                            max-mobile:top-[2%] max-mobile:left-[2%]
                        "
                        href="/image-collections/"
                    >
                        Gå til bilder
                    </Link>
                </div>
            </PopUpProvider>
        </PopUp>
    )
}
