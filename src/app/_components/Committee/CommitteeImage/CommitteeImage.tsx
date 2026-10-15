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
        <div className={[
            'flex items-stretch gap-2 w-full mb-2',
            'max-mobile:relative max-mobile:h-[180px] max-mobile:bg-surface-base max-mobile:rounded-round',
            'max-mobile:overflow-hidden',
        ].join(' ')}>
            <div className={[
                'shrink-0 flex items-center justify-center bg-surface-base rounded-round p-4',
                'max-mobile:relative max-mobile:z-1 max-mobile:m-auto max-mobile:bg-surface-base/70 max-mobile:p-2',
                'max-mobile:pointer-events-none max-mobile:[&>*]:w-[120px]!',
            ].join(' ')}>
                <CommitteeLogo
                    className={grayScale ? 'grayscale brightness-50 contrast-150' : ''}
                    logoImage={logoImage}
                    width={200}
                />
            </div>
            <div className={[
                'relative flex-1 min-w-0 h-80 bg-surface-base rounded-round overflow-hidden',
                'max-mobile:absolute max-mobile:inset-0 max-mobile:h-auto max-mobile:rounded-none',
            ].join(' ')}>
                <CmsImage
                    capabilities={{ canEdit: capabilities.canEditCoverImage }}
                    updateCmsImageAction={configureAction(
                        updateCommitteeArticleCoverImageAction,
                        { implementationParams: { shortName } }
                    )}
                    className={[
                        'absolute! inset-0 w-full! h-full! [&>*]:absolute [&>*]:inset-0 [&>*]:w-full! [&>*]:h-full!',
                        '[&>*_div]:w-full! [&>*_div]:h-full!',
                        '[&>*_img]:w-full! [&>*_img]:h-full! [&>*_img]:object-cover [&>*_img]:object-center',
                    ].join(' ')}
                    cmsImage={coverImage}
                    width={600}
                />
            </div>
            <div className="relative">
                {children}
            </div>
        </div>
    )
}

