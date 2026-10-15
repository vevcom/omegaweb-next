'use client'
import ImagePanelImage from './ImagePanelImage'
import ImageDisplay from './ImageDisplay'
import Button from '@/components/UI/Button'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faImages } from '@fortawesome/free-solid-svg-icons'
import { useEffect, useState } from 'react'
import { useInView } from 'react-intersection-observer'
import type { Page } from '@/lib/paging/types'
import type { ActionReturn } from '@/services/actionTypes'
import type { ErrorCode } from '@/services/error'
import type { ExpandedImage } from '@/services/images/subservice/types'

export type ImagePanelCursor = {
    imageId: number,
}

/**
 * The pager the panel is built around. Dynamic collections bind their collectionId into it,
 * special collections need nothing bound - either way the panel itself only ever sees "give me the
 * page after this cursor".
 *
 * WARNING: The panel treats a new function identity as "this is a different collection" and resets
 * itself, so the injected action must be referentially stable (module-level, or wrapped in
 * useCallback with the collection as dependency) - an inline arrow recreated every render would
 * reset the panel every render.
 */
export type ReadPageOfImagesInCollectionAction<PageSize extends number> = (
    page: Page<PageSize, ImagePanelCursor>
) => Promise<ActionReturn<ExpandedImage[]>>

type SelectionPropTypes = {
    selectionActive: true,
    onSelectedImageChange: (image: ExpandedImage | null) => void,
    defaultSelectedImage?: ExpandedImage,
} | {
    selectionActive?: false,
    onSelectedImageChange?: never,
    defaultSelectedImage?: never,
}

type PropTypes<PageSize extends number> = {
    readPageOfImagesInCollectionAction: ReadPageOfImagesInCollectionAction<PageSize>,
    pageSize: PageSize,
    withImageDisplay?: boolean,
} & SelectionPropTypes

/**
 * The pages loaded so far, stamped with the action that loaded them. The stamp is what makes an
 * action change safe: state loaded through another action - whether read directly or written late
 * by a fetch that resolved after the action changed - is simply not "current" for the new action,
 * so it is ignored and eventually overwritten instead of needing explicit invalidation.
 */
type PagingState<PageSize extends number> = {
    forAction: ReadPageOfImagesInCollectionAction<PageSize>,
    images: ExpandedImage[],
    nextPageNumber: number,
    allLoaded: boolean,
}

/**
 * An explicitly requested page load (as opposed to the loads the panel starts by itself for the
 * first page and the endless scroll). advanceDisplay makes the large display move onto the first
 * image of the new page once it arrives - the "navigate right past the last loaded image" case.
 */
type LoadRequest = {
    advanceDisplay: boolean,
}

// An empty collection gets an empty state rather than the pager's "nothing more to load".
const emptyClassName = [
    'flex flex-col items-center gap-2 py-12 text-ink-hover text-center',
    '[&>svg]:text-[calc(6*var(--gap))] [&>svg]:opacity-50',
].join(' ')

/**
 * A self-contained panel of the images in one collection: paging (endless scroll), selection and
 * the large image display in one component, driven entirely by the injected pager action - no
 * contexts and no server rendered data.
 *
 * @param readPageOfImagesInCollectionAction - the pager to read image pages through. When its
 * identity changes the panel treats it as a different collection: all loaded pages, errors and the
 * open display are dropped and the first page is refetched. The selection is kept, since the
 * selected image (e.g. the image a cms image currently links to) does not have to belong to the
 * collection being browsed.
 * @param pageSize - the page size the pager is called with
 * @param withImageDisplay - if true, clicking an image opens the large ImageDisplay
 * @param selectionActive - if true, images can be selected (checkmark button on each image)
 * @param onSelectedImageChange - called with the new selection when the user selects/deselects
 * @param defaultSelectedImage - the image selected before the user has made a choice
 */
export default function ImagePanel<const PageSize extends number>({
    readPageOfImagesInCollectionAction,
    pageSize,
    withImageDisplay = false,
    selectionActive = false,
    onSelectedImageChange,
    defaultSelectedImage,
}: PropTypes<PageSize>) {
    const [pagingState, setPagingState] = useState<PagingState<PageSize> | null>(null)
    const [errorCode, setErrorCode] = useState<ErrorCode | null>(null)
    const [selectedImage, setSelectedImage] = useState<ExpandedImage | null>(defaultSelectedImage ?? null)
    const [displayedImage, setDisplayedImage] = useState<ExpandedImage | null>(null)
    const [loadRequest, setLoadRequest] = useState<LoadRequest | null>(null)

    // State loaded through a previous action is stale, never rendered and never built upon.
    const currentPagingState =
        pagingState !== null && pagingState.forAction === readPageOfImagesInCollectionAction
            ? pagingState
            : null

    // A new action identity means a different collection - drop everything from the old one during
    // render (before children render with stale state). The paging state needs no explicit reset
    // since it is stamped, and the fetch effect refetches once the current state derives to null.
    const [previousAction, setPreviousAction] = useState(() => readPageOfImagesInCollectionAction)
    if (previousAction !== readPageOfImagesInCollectionAction) {
        setPreviousAction(() => readPageOfImagesInCollectionAction)
        setErrorCode(null)
        setDisplayedImage(null)
        setLoadRequest(null)
    }

    const [loadControlRef, loadControlInView] = useInView({ threshold: 0 })

    const allLoaded = currentPagingState?.allLoaded ?? false

    // Fetching is declarative: a fetch should be running exactly when there is something to load
    // and a reason to load it. The effect below starts it and writes the result back, which either
    // satisfies the reason or (via the scroll sentinel still being in view) chains the next page.
    const fetchPending = errorCode === null && !allLoaded && (
        currentPagingState === null
        || loadControlInView
        || loadRequest !== null
    )

    useEffect(() => {
        if (!fetchPending) return undefined
        let cancelled = false

        const page: Page<PageSize, ImagePanelCursor> =
            currentPagingState && currentPagingState.images.length > 0 ? {
                pageSize,
                page: currentPagingState.nextPageNumber,
                cursor: { imageId: currentPagingState.images[currentPagingState.images.length - 1].id },
            } : {
                pageSize,
                page: 0,
                cursor: null,
            }

        void readPageOfImagesInCollectionAction(page).then(result => {
            if (cancelled) return
            if (!result.success) {
                setErrorCode(result.errorCode)
                setLoadRequest(null)
                return
            }
            const previousImages = currentPagingState?.images ?? []
            setPagingState({
                forAction: readPageOfImagesInCollectionAction,
                images: [...previousImages, ...result.data],
                nextPageNumber: (currentPagingState?.nextPageNumber ?? 0) + 1,
                allLoaded: result.data.length < pageSize,
            })
            if (loadRequest?.advanceDisplay) {
                // Move onto the new page, wrapping to the start if it turned out to be empty - but
                // only if the display is still open.
                const nextDisplayed = result.data[0] ?? previousImages[0] ?? null
                setDisplayedImage(current => (current === null ? null : nextDisplayed))
            }
            setLoadRequest(null)
        })

        return () => {
            cancelled = true
        }
    }, [fetchPending, currentPagingState, loadRequest, pageSize, readPageOfImagesInCollectionAction])

    const toggleSelected = (image: ExpandedImage) => {
        const newSelected = selectedImage?.id === image.id ? null : image
        setSelectedImage(newSelected)
        onSelectedImageChange?.(newSelected)
    }

    const navigateLeft = () => {
        if (!currentPagingState || !displayedImage) return
        const currentIndex = currentPagingState.images.findIndex(image => image.id === displayedImage.id)
        const nextIndex = currentIndex <= 0 ? currentPagingState.images.length - 1 : currentIndex - 1
        setDisplayedImage(currentPagingState.images[nextIndex])
    }

    const navigateRight = () => {
        if (!currentPagingState || !displayedImage) return
        const currentIndex = currentPagingState.images.findIndex(image => image.id === displayedImage.id)
        if (currentIndex < currentPagingState.images.length - 1) {
            setDisplayedImage(currentPagingState.images[currentIndex + 1])
            return
        }
        if (!currentPagingState.allLoaded) {
            setLoadRequest({ advanceDisplay: true })
            return
        }
        setDisplayedImage(currentPagingState.images[0])
    }

    const images = currentPagingState?.images ?? []

    const renderLoadControlContent = () => {
        if (errorCode !== null) return <p>Noe gikk galt</p>
        if (fetchPending) return <i>{images.length > 0 ? 'Laster inn flere...' : 'Laster inn...'}</i>
        if (allLoaded) {
            if (images.length > 0) return <i>Ingen flere å laste inn</i>
            return <span className={emptyClassName}>
                <FontAwesomeIcon icon={faImages} />
                <i>Ingen bilder i denne samlingen enda</i>
            </span>
        }
        return <Button onClick={() => setLoadRequest({ advanceDisplay: false })}>Last inn flere</Button>
    }

    return (
        <div className="flex flex-row flex-wrap gap-2 relative">
            {images.map(image => (
                <ImagePanelImage
                    key={image.id}
                    image={image}
                    selected={selectedImage?.id === image.id}
                    onOpenDisplay={withImageDisplay ? () => setDisplayedImage(image) : undefined}
                    onToggleSelect={selectionActive ? () => toggleSelected(image) : undefined}
                />
            ))}
            <span ref={loadControlRef} className="w-full flex justify-center items-center my-2">
                {renderLoadControlContent()}
            </span>
            {withImageDisplay && displayedImage && (
                <ImageDisplay
                    image={displayedImage}
                    loading={fetchPending}
                    onClose={() => setDisplayedImage(null)}
                    onNavigateLeft={navigateLeft}
                    onNavigateRight={navigateRight}
                />
            )}
        </div>
    )
}
