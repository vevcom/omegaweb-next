'use client'
import ChangeImageForm from './ChangeImageForm'
import Image from '@/components/Image/Image'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTurnUp } from '@fortawesome/free-solid-svg-icons'
import type { ExpandedImage } from '@/services/images/subservice/types'
import type { UpdateCmsImageAction } from '@/cms/images/types'

type PropTypes = {
    currentImage: ExpandedImage | null,
    selectedImage: ExpandedImage | null,
    cmsImageId: number,
    updateCmsImageAction: UpdateCmsImageAction
}

const imageClipClassName = `
    overflow-hidden rounded-round relative flex justify-center items-center
    [&_img]:w-full! [&_img]:max-h-full [&_img]:object-cover [&_img]:rounded-round [&_img]:overflow-hidden
`

const gridCellClassName = `
    w-[calc(min(200px,24vh)/2)] max-h-[calc(min(200px,24vh)/2)]
    [&>*]:w-full! [&>*]:max-h-full
`

const arrowClassName = 'w-[70%] h-[70%] place-self-center'

export default function ChangeImage({
    currentImage,
    selectedImage,
    cmsImageId,
    updateCmsImageAction,
}: PropTypes) {
    // A selection only counts as "new" if it differs from the current image - or there is no
    // current image yet, in which case this is the user's first choice for this slot.
    const hasNewSelection = selectedImage !== null && selectedImage.id !== currentImage?.id
    const displayImage = selectedImage ?? currentImage

    const renderSubmitControls = () => {
        if (hasNewSelection && selectedImage) {
            return (
                <ChangeImageForm
                    cmsImageId={cmsImageId}
                    selectedImage={selectedImage}
                    updateCmsImageAction={updateCmsImageAction}
                />
            )
        }
        if (!currentImage) {
            return <p>Velg et bilde for å legge det til</p>
        }
        return null
    }

    return (
        <div className="
            mt-[.6em] max-w-[min(200px,24vh)]
            [&>i]:text-ellipsis [&>i]:whitespace-nowrap
        ">
            {
                currentImage && selectedImage && hasNewSelection ? (
                    <div className="w-[min(200px,24vh)] max-h-[min(200px,24vh)] grid grid-cols-2 grid-rows-2">
                        <div className={`
                            ${imageClipClassName}
                            ${gridCellClassName}
                        `}>
                            <Image width={200} image={currentImage} />
                        </div>
                        <div className={`
                            ${imageClipClassName}
                            ${gridCellClassName}
                        `}>
                            <Image width={200} image={selectedImage} />
                        </div>
                        <FontAwesomeIcon className={`
                            ${arrowClassName}
                            col-[1/2] row-[2/3] rotate-90
                        `} icon={faTurnUp} />
                        <FontAwesomeIcon
                            className={`
                                ${arrowClassName}
                                col-[2/3] row-[1/2] [transform:scaleX(-1)_rotate(180deg)]
                            `}
                            icon={faTurnUp}
                        />
                    </div>
                ) : (
                    <div className={`
                        ${imageClipClassName}
                        w-[min(200px,24vh)] max-h-[min(200px,24vh)]
                    `}>
                        {displayImage ? <Image width={200} image={displayImage} /> : <p>Ingen bilde valgt enda</p>}
                    </div>
                )
            }
            <i>{displayImage ? `image name: ${displayImage.name}` : 'ingen bilde valgt enda'}</i>
            {renderSubmitControls()}
        </div>
    )
}

