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
        <div className={styles.ImageDisplay}>
            <div className={styles.panel} ref={panelRef}>
                <div className={styles.header}>
                    <div className={styles.meta}>
                        <h2>{image.name}</h2>
                        <dl>
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
                    <button onClick={onClose} className={styles.close} aria-label="Lukk">
                        <FontAwesomeIcon icon={faX}/>
                    </button>
                </div>

                <div className={styles.currentImage}>
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

                <div className={styles.footer}>
                    <span className={styles.footerSpacer} />
                    <div className={styles.controls}>
                        <button onClick={onNavigateLeft} aria-label="Forrige bilde">
                            <FontAwesomeIcon icon={faChevronLeft}/>
                        </button>
                        <button onClick={onNavigateRight} aria-label="Neste bilde">
                            <FontAwesomeIcon icon={faChevronRight}/>
                        </button>
                    </div>
                    <div className={styles.selectImageSize}>
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
