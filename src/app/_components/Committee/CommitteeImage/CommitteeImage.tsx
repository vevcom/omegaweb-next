import styles from './CommitteeImage.module.scss'
import CommitteeLogo from '@/components/Committee/CommitteeLogo/CommitteeLogo'
import CmsImage from '@/cms/CmsImage/CmsImage'
import { configureAction } from '@/services/configureAction'
import { updateCommitteeArticleCoverImageAction } from '@/services/groups/committees/actions'
import type { ReactNode } from 'react'
import type { ExpandedImage } from '@/services/images/subservice/types'
import type { ExpandedCmsImage } from '@/cms/images/types'
import type { Capabilities } from '@/auth/authorizer/capabilities'

type PropTypes = {
    children?: ReactNode
    logoImage: ExpandedImage
    coverImage: ExpandedCmsImage
    grayScale?: boolean,
    shortName: string
    capabilities: Capabilities<'canEditCoverImage'>
}
export default function CommitteeImage({
    children,
    logoImage,
    coverImage,
    shortName,
    capabilities,
    grayScale = false
}: PropTypes) {
    return (
        <div className={styles.CommitteeImage}>
            <div className={styles.logoIsland}>
                <CommitteeLogo
                    className={grayScale ? styles.gray : ''}
                    logoImage={logoImage}
                    width={200}
                />
            </div>
            <div className={styles.coverIsland}>
                <CmsImage
                    capabilities={{ canEdit: capabilities.canEditCoverImage }}
                    updateCmsImageAction={configureAction(
                        updateCommitteeArticleCoverImageAction,
                        { implementationParams: { shortName } }
                    )}
                    className={styles.committeeImage}
                    cmsImage={coverImage}
                    width={600}
                />
            </div>
            <div className={styles.content}>
                {children}
            </div>
        </div>
    )
}

