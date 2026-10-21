import animation from './BackdropImage.module.scss'
import Image from '@/components/Image/Image'
import type { CSSProperties, ReactNode } from 'react'
import type { ExpandedImage } from '@/services/images/subservice/types'

const defaultImageSize = 400

type PropTypes = {
    children: ReactNode
    image: ExpandedImage
    grayScale?: boolean
    imageSize?: number
}
/**
 * A component that renders a backdrop image with a content div on top of it. It fills its
 * container, so the height of the backdrop is decided by whatever it is placed inside.
 * @param children - The content to render on top of the image
 * @param image - The image to render as a backdrop
 * @param grayScale - Whether the image should be rendered in grayscale (true by default)
 * @param imageSize - The rendered size of the backdrop image - the visible corner it peeks out
 * of scales with it
 * */
export default function BackdropImage({ children, image, grayScale = true, imageSize }: PropTypes) {
    const size = imageSize ?? defaultImageSize

    return (
        <div
            className="relative isolate h-full"
            style={{ '--backdrop-image-size': `${size}px` } as CSSProperties}
        >
            <div className="z-1 h-full">
                {children}
            </div>
            <div className={`
                absolute right-0 bottom-0 -z-1 w-[calc(0.6*var(--backdrop-image-size))] opacity-0 flex items-end
                overflow-hidden
                [&_*]:size-(--backdrop-image-size)
                ${animation.fadeIn}
            `}>
                <Image
                    className={grayScale ? 'grayscale brightness-50 contrast-150' : ''}
                    image={image}
                    width={size}
                />
            </div>
        </div>
    )
}
