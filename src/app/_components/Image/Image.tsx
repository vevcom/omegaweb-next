import { resolutionForWidth } from '@/lib/images/resolutionForWidth'
import { imageSourceForResolution, srcSetForImage } from '@/lib/images/imageSource'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCopyright } from '@fortawesome/free-solid-svg-icons'
import type { ImageResolution } from '@/lib/images/resolutionForWidth'
import type { ExpandedImage } from '@/services/images/subservice/types'
import type { ImageProps } from 'next/image'
import type { CSSProperties } from 'react'

export type PropTypes = Omit<ImageProps, 'src' | 'alt'> & {
    image: ExpandedImage,
    width: number,
    resolution?: ImageResolution,
    alt?: string,
    imageContainerClassName?: string,
    creditPlacement?: 'top' | 'bottom',
    hideCredit?: boolean,
    hideCopyRight?: boolean,
    disableLinkingToLicense?: boolean,
    tint?: string,
    tintAspectRatio?: number,
}

const imageClassName = [
    '[:where(&)]:relative [:where(&)]:m-0 [:where(&)]:box-border [:where(&)]:flex [:where(&)]:flex-col',
    '[:where(&)]:w-(--image-width) [&>img]:m-0 [&>img]:w-full [&>img]:h-full',
].join(' ')

const creditPlacementClassName = {
    top: 'top-0 left-0',
    bottom: 'bottom-0 left-0',
}

/**
 * A component to display a Image from the database
 * @param alt - (optional) the alt text of the image (will be set to image.alt if not provided)
 * @param image - the image to display
 * @param width - the width of the image - this also determines the resolution of the image to display
 * @param resolution - (optional) The resolution inferred from the width may be overrided using
 * this prop, but only do so if strictly necessary. The resolution is used to determine which image
 * file to display. Passing this disables srcset, since overriding resolution is a deliberate
 * single choice.
 * @param imageContainerClassName - (optional) the class name of the
 * @param creditPlacement - (optional) the placement of the credit
 * @param hideCredit - (optional) if true, the credit will be hidden
 * @param hideCopyRight - (optional) if true, the copy right will be hidden
 * @param disableLinkingToLicense - (optional) if true, the license will not be linked rather
 * the name will be disblayed alone
 * @param props - the rest of the props to pass to the img tag
 */
export default function Image({
    alt,
    image,
    width,
    resolution: explicitResolution,
    imageContainerClassName,
    creditPlacement = 'bottom',
    hideCredit = false,
    hideCopyRight = false,
    disableLinkingToLicense = false,
    tint,
    tintAspectRatio = 1,
    ...props
}: PropTypes) {
    const url = imageSourceForResolution(image, explicitResolution ?? resolutionForWidth(width))
    const srcSet = explicitResolution ? undefined : srcSetForImage(image)
    const imageWidthStyle = { '--image-width': `${width}px` } as CSSProperties

    return (
        <div style={imageWidthStyle} className={`${imageClassName} ${imageContainerClassName}`}>
            {tint && image.type === 'SVG' ? (
                // A mask has no intrinsic size, so aspect-ratio is set inline; `contain` letterboxes
                // a mismatched ratio rather than stretching.
                <div
                    className={[
                        'w-full [mask-image:var(--image-tint-mask)] mask-contain mask-no-repeat mask-center',
                        'bg-(--image-tint-color)',
                    ].join(' ')}
                    style={{
                        '--image-tint-mask': `url('${url}')`,
                        '--image-tint-color': tint,
                        aspectRatio: tintAspectRatio,
                    } as CSSProperties}
                    role="img"
                    aria-label={alt || image.alt}
                />
            ) : (
                <img {...props}
                    width={width}
                    alt={alt || image.alt}
                    src={url}
                    srcSet={srcSet}
                    sizes={srcSet ? `${width}px` : undefined}
                />
            )}
            {image.credit && !hideCredit && (
                <p className={`absolute bg-surface-base opacity-50 p-[.5em] ${creditPlacementClassName[creditPlacement]}`}>
                    {image.credit}
                </p>
            )}
            {!hideCopyRight && image.licenseLink && (
                <div className={[
                    'group absolute right-0 top-0 z-2 flex flex-row items-center justify-around no-underline text-text',
                    'hover:bg-surface-base hover:opacity-80',
                ].join(' ')}>
                    {disableLinkingToLicense ? (
                        <p className="hidden group-hover:inline text-s ml-[.5em]">{image.licenseName}</p>
                    ) : (
                        <Link
                            href={image.licenseLink}
                            target="_blank"
                            referrerPolicy="no-referrer"
                            className="hidden group-hover:inline text-s ml-[.5em]"
                        >
                            {image.licenseName}
                        </Link>
                    )}
                    <FontAwesomeIcon icon={faCopyright} className="text-text w-[20px]! h-[20px]! m-[.6em]"/>
                </div>
            )}
        </div>
    )
}

type SrcImageProps = Omit<PropTypes, 'image' | 'resolution'> & {
    src: string
}

/**
 * A component  meant to look like Image but with a src instead of an image. Only used in
 * worst case scenario, probably to render things in /public
 * @param src - the source of the image
 * @param width - the width of the image
 * @returns
 */
export function SrcImage({ src, width, ...props }: SrcImageProps) {
    const imageWidthStyle = { '--image-width': `${width}px` } as CSSProperties

    return (
        <div style={imageWidthStyle} className={imageClassName}>
            <img {...props} width={width} src={src} />
        </div>
    )
}
