import styles from './StandardImage.module.scss'
import Image, { SrcImage } from './Image'
import { standardImageCollectionOperations } from '@/services/images/standard/operations'
import { withFallback, withPageSession } from '@/app/serverPage'
import type { PropTypes as ImagePropTypes } from './Image'
import type { StandardImage as StandardImageT } from '@/prisma-generated-pn-types'
import type React from 'react'

export type PropTypes = Omit<ImagePropTypes, 'image'> & {
    standardImage: StandardImageT,
    children?: React.ReactNode,
}

const fallbackImage = '/images/fallback.jpg'

/**
 * WARNING: This component is only meant for the server - use StandardImageClient for the client
 * A component that fetches a standard image and displays it. Unlike SpecialCmsImage, standard
 * images are resolved/generated from static config rather than being admin-editable, so this
 * component is read-only. Falls back to a static placeholder if the standard image cannot be
 * resolved at all (should essentially never happen, as it self-heals from static config).
 * @param standardImage - the standard image to display
 * @returns
 */
export default async function StandardImageServer({ standardImage, children, className = '', ...props }: PropTypes) {
    const image = await withPageSession(() => withFallback(
        standardImageCollectionOperations.readStandardImage({ params: { standardImage } }),
        null
    ))

    return (
        <div className={`${styles.StandardImage} ${className}`}>
            {image ? (
                <Image image={image} {...props} />
            ) : (
                <SrcImage src={fallbackImage} {...props} />
            )}
            {children && <div className={styles.children}>{children}</div>}
        </div>
    )
}
