'use client'
import styles from './ImageDisplay.module.scss'
import { SelectString } from '@/components/UI/Select'
import Image from '@/components/Image/Image'
import useKeyPress from '@/hooks/useKeyPress'
import useClickOutsideRef from '@/hooks/useClickOutsideRef'
import { imageSourceForResolution } from '@/lib/images/imageSource'
import { faChevronRight, faChevronLeft, faX } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useCallback, useState } from 'react'
import Link from 'next/link'
import type { ImageResolution } from '@/lib/images/resolutionForWidth'
import type { ExpandedImage } from '@/services/images/subservice/types'

const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    bmp: 'image/bmp',
    webp: 'image/webp',
    avif: 'image/avif',
    tiff: 'image/tiff',
    svg: 'image/svg+xml',
}
const getCurrentType = (image: ExpandedImage, size: ImageResolution) => {
    const source = imageSourceForResolution(image, size)
    if (source.startsWith('data:')) return source.slice('data:'.length, source.indexOf(';'))
    const ext = source.split('.').pop()
    if (!ext) return 'unknown'
    return mimeTypes[ext] ?? 'unknown'
}

type PropTypes = {
    image: ExpandedImage,
    loading: boolean,
    onClose: () => void,
    onNavigateLeft: () => void,
    onNavigateRight: () => void,
}

const navButtonClassName = [
    'size-10 grid place-items-center rounded-full border-none cursor-pointer bg-surface-raised text-text',
    'transition-[background-color] duration-300 hover:bg-surface-hover [&>svg]:w-[45%]! [&>svg]:h-[45%]!',
].join(' ')

/**
 * The large view of the image an ImagePanel is currently displaying. A pure viewer - navigation,
 * closing and what image to show are the panel's responsibility, and administration of the image
 * lives outside the panel system entirely.
 * @param image - the image to display
 * @param loading - whether the panel is fetching (navigating right into a not-yet-loaded page)
 * @param onClose - called when the display is closed (close button, Escape or a click outside)
 * @param onNavigateLeft - called on the left arrow (button or key)
 * @param onNavigateRight - called on the right arrow (button or key)
 */
export default function ImageDisplay({ image, loading, onClose, onNavigateLeft, onNavigateRight }: PropTypes) {
    const [imageSize, setImageSize] = useState<ImageResolution>('LARGE')

    useKeyPress('ArrowRight', onNavigateRight)
    useKeyPress('ArrowLeft', onNavigateLeft)
    useKeyPress('Escape', onClose)

    const handleClickOutside = useCallback(() => onClose(), [onClose])
    const panelRef = useClickOutsideRef(handleClickOutside)

    const handleSizeChange = (size: string) => {
        if (
            size === 'MICRO' || size === 'TINY' || size === 'SMALL' || size === 'MEDIUM' ||
            size === 'LARGE' || size === 'HUGE' || size === 'ORIGINAL'
        ) {
            setImageSize(size)
        }
    }

    return (
        <div className={[
            'z-5 fixed top-0 left-0 w-screen h-dvh grid place-items-center',
            'bg-[rgba(0,0,0,0.55)] backdrop-blur-[2px]',
        ].join(' ')}>
            <div className={[
                'relative w-[95vw] h-[95dvh] flex flex-col gap-4 p-4 rounded-round bg-surface-base',
            ].join(' ')} ref={panelRef}>
                <div className="shrink-0 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <h2 className="font-secondary text-xl font-bold overflow-hidden text-ellipsis whitespace-nowrap">
                            {image.name}
                        </h2>
                        <dl className={[
                            'mt-2 flex flex-wrap gap-x-4 gap-y-0 text-s text-text-muted',
                            '[&>div]:flex [&>div]:gap-[0.4em] [&>div]:min-w-0',
                            '[&_dt]:text-ink-hover [&_dd]:overflow-hidden [&_dd]:text-ellipsis [&_dd]:whitespace-nowrap',
                        ].join(' ')}>
                            <div>
                                <dt>Alt-tekst:</dt>
                                <dd>{image.alt}</dd>
                            </div>
                            <div>
                                <dt>Type:</dt>
                                <dd>{getCurrentType(image, imageSize)}</dd>
                            </div>
                            <div>
                                <dt>Kreditert:</dt>
                                <dd>{image.credit ?? 'ingen'}</dd>
                            </div>
                            <div>
                                <dt>Lisens:</dt>
                                <dd>{
                                    image.licenseLink ?
                                        <Link
                                            href={image.licenseLink}
                                            target="_blank"
                                            referrerPolicy="no-referrer"
                                        >
                                            {image.licenseName}
                                        </Link>
                                        : 'ingen'
                                }</dd>
                            </div>
                        </dl>
                    </div>
                    <button onClick={onClose} className="shrink-0 close-btn" aria-label="Lukk">
                        <FontAwesomeIcon icon={faX}/>
                    </button>
                </div>

                <div className={[
                    'flex-auto min-h-0 relative',
                    '[&_div]:absolute [&_div]:inset-0 [&_div]:w-full [&_div]:h-full',
                    '[&_img]:absolute [&_img]:inset-0 [&_img]:w-full [&_img]:h-full [&_img]:object-contain',
                    '[&_img]:rounded-round',
                ].join(' ')}>
                    {
                        loading ? (
                            <div className={styles.loading}></div>
                        ) : (
                            <Image
                                hideCredit
                                hideCopyRight
                                width={200}
                                resolution={imageSize}
                                image={image}
                            />
                        )
                    }
                </div>

                <div className="shrink-0 flex items-center gap-2 max-mobile:flex-wrap">
                    <span className="flex-none w-44 max-mobile:hidden" />
                    <div className="flex-auto flex justify-center gap-2">
                        <button onClick={onNavigateLeft} className={navButtonClassName} aria-label="Forrige bilde">
                            <FontAwesomeIcon icon={faChevronLeft}/>
                        </button>
                        <button onClick={onNavigateRight} className={navButtonClassName} aria-label="Neste bilde">
                            <FontAwesomeIcon icon={faChevronRight}/>
                        </button>
                    </div>
                    <div className="flex-none w-44 [&>*]:mt-0! max-mobile:w-full max-mobile:-order-1">
                        <SelectString
                            defaultValue={imageSize}
                            value={imageSize}
                            onChange={handleSizeChange}
                            name="imageSize"
                            label="Oppløsning"
                            options={[
                                {
                                    label: 'Ørliten',
                                    value: 'MICRO'
                                },
                                {
                                    label: 'Veldig liten',
                                    value: 'TINY'
                                },
                                {
                                    label: 'Liten',
                                    value: 'SMALL'
                                },
                                {
                                    label: 'Middels',
                                    value: 'MEDIUM'
                                },
                                {
                                    label: 'Stor',
                                    value: 'LARGE'
                                },
                                {
                                    label: 'Veldig stor',
                                    value: 'HUGE'
                                },
                                {
                                    label: 'Original',
                                    value: 'ORIGINAL'
                                }
                            ]}/>
                    </div>
                </div>
            </div>
        </div>
    )
}
