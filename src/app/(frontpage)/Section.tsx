import styles from './Section.module.scss'
import SpecialCmsParagraph from '@/components/Cms/CmsParagraph/SpecialCmsParagraph'
import SpecialCmsImage from '@/components/Cms/CmsImage/SpecialCmsImage'
import {
    readSpecialCmsImageFrontpageAction,
    readSpecialCmsParagraphFrontpageSectionAction,
    updateSpecialCmsImageFrontpageAction,
    updateSpecialCmsParagraphFrontpageSectionAction
} from '@/services/frontpage/actions'
import Link from 'next/link'
import type {
    SpecialCmsImage as SpecialCmsImageT,
    SpecialCmsParagraph as SpecialCmsParagraphT
} from '@/prisma-generated-pn-types'
import type { Capabilities } from '@/auth/authorizer/capabilities'
import type { ReactNode } from 'react'

type PropTypes = {
    specialCmsImage: SpecialCmsImageT,
    specialCmsParagraph: SpecialCmsParagraphT,
    capabilities: Capabilities<'canEditSpecialCmsImage' | 'canEditSpecialCmsParagraph'>,
    readMore: string,
    position: 'left' | 'right',
    imgWidth: number,
    id?: string,
    children?: ReactNode,
}

function Section({
    specialCmsImage,
    specialCmsParagraph,
    capabilities,
    readMore,
    position,
    imgWidth,
    id,
    children
}: PropTypes) {
    const imgContainer = (
        <div style={{ width: imgWidth }} className={styles.imgContainer}>
            <SpecialCmsImage
                capabilities={{ canEdit: capabilities.canEditSpecialCmsImage }}
                special={specialCmsImage}
                width={imgWidth}
                readSpecialCmsImageAction={readSpecialCmsImageFrontpageAction}
                updateCmsImageAction={updateSpecialCmsImageFrontpageAction}
            />
        </div>
    )
    return (
        <div id={id} className={`${styles.section} ${position === 'right' && styles.blue}`}>
            {position === 'left' && imgContainer}
            <div>
                <SpecialCmsParagraph
                    capabilities={{ canEdit: capabilities.canEditSpecialCmsParagraph }}
                    className={styles.paragraph}
                    special={specialCmsParagraph}
                    readSpecialCmsParagraphAction={readSpecialCmsParagraphFrontpageSectionAction}
                    updateCmsParagraphAction={updateSpecialCmsParagraphFrontpageSectionAction}
                />
                <Link className={styles.readMore} href={readMore}>Les mer</Link>
                {children}
            </div>
            {position === 'right' && imgContainer}
        </div>
    )
}

export default Section
