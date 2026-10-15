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
    // CmsImage's wrapper divs size themselves off the image's intrinsic width rather than off this
    // container, so every wrapper div (at whatever depth) is forced to fill it. They stay absolute
    // rather than height: 100% because this box's height comes from the grid row stretching to the
    // text column, and Firefox collapses a percentage height against that to 0.
    const imgContainer = (
        <div style={{ width: imgWidth }} className={[
            'm-4 rounded-round relative overflow-hidden mobile:max-w-[50vw]',
            '[&_div]:absolute [&_div]:top-0 [&_div]:left-0 [&_div]:size-full',
            '[&_img]:absolute [&_img]:top-0 [&_img]:left-0 [&_img]:size-full [&_img]:object-cover',
            'max-mobile:row-start-2 max-mobile:row-end-3',
            'max-mobile:min-w-full max-mobile:max-h-[50vh] max-mobile:max-w-screen',
        ].join(' ')}>
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
        <div id={id} className={[
            'grid overflow-hidden mobile:grid-cols-[auto_auto] max-mobile:grid-cols-[auto] max-mobile:grid-rows-[auto_auto]',
            position === 'right' ? 'bg-[color-mix(in_srgb,var(--surface-base),black_15%)]' : 'bg-surface-base text-text',
        ].join(' ')}>
            {position === 'left' && imgContainer}
            <div className={[
                'p-30 h-full flex flex-col justify-center max-mobile:p-20 max-mobile:w-screen',
                '[&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-2 [&_p]:text-m [&_p]:leading-[1.7em] [&_p]:mb-2',
                '[&>a]:w-[120px] [&>a]:m-0',
            ].join(' ')}>
                <SpecialCmsParagraph
                    capabilities={{ canEdit: capabilities.canEditSpecialCmsParagraph }}
                    className={position === 'right' ? '[&_:is(h1,h2,h3,h4,h5,h6,p,i)]:text-text' : ''}
                    special={specialCmsParagraph}
                    readSpecialCmsParagraphAction={readSpecialCmsParagraphFrontpageSectionAction}
                    updateCmsParagraphAction={updateSpecialCmsParagraphFrontpageSectionAction}
                />
                <Link className="secondary-btn" href={readMore}>Les mer</Link>
                {children}
            </div>
            {position === 'right' && imgContainer}
        </div>
    )
}

export default Section
