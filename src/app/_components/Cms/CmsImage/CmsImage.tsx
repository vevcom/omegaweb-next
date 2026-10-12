import CmsImageEditor from './CmsImageEditor'
import styles from './CmsImage.module.scss'
import Image from '@/components/Image/Image'
import StandardImageClient from '@/components/Image/StandardImageClient'
import { capabilitiesToJsObject } from '@/auth/authorizer/capabilities'
import type { ExpandedCmsImage, UpdateCmsImageAction } from '@/cms/images/types'
import type { PropTypes as ImagePropTypes } from '@/components/Image/Image'
import type { Capabilities } from '@/auth/authorizer/capabilities'
import type React from 'react'

export type PropTypes = Omit<ImagePropTypes, 'className' | 'image' | 'children'> & {
    cmsImage: ExpandedCmsImage,
    updateCmsImageAction: UpdateCmsImageAction,
    capabilities: Capabilities<'canEdit'>
    children?: React.ReactNode
    className?: string
    classNameImage?: string
    disableEditor?: boolean
}

/**
 * A function to display a cms image with image relation. If the cms image has no image, the
 * DEFAULT_IMAGE standard image is displayed in its place instead. The editor is shown regardless -
 * CmsImageEditor accepts a null image, treating that as the user choosing an image for the first
 * time.
 * @param cmsImage - the cms image to display with image relation
 * @param children - the children to display besides image
 * @returns
 */
export default function CmsImage({
    cmsImage,
    updateCmsImageAction,
    capabilities,
    children,
    className = '',
    classNameImage,
    disableEditor = false,
    ...props
}: PropTypes) {
    return (
        <div className={`${styles.CmsImage} ${className}`}>
            {!disableEditor && <CmsImageEditor
                cmsImage={cmsImage}
                updateCmsImageAction={updateCmsImageAction}
                capabilities={capabilitiesToJsObject(capabilities)}
            />}
            <div className={styles.children}>{children}</div>
            {cmsImage.image ? (
                <Image className={classNameImage} image={cmsImage.image} {...props}/>
            ) : (
                <StandardImageClient standardImage="DEFAULT_IMAGE" className={classNameImage} {...props}/>
            )}
        </div>
    )
}
