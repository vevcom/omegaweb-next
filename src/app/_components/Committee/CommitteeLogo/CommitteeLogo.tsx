import Image from '@/components/Image/Image'
import { imageSourceForResolution } from '@/lib/images/imageSource'
import type { CSSProperties } from 'react'
import type { ExpandedImage } from '@/services/images/subservice/types'

type PropTypes = {
    logoImage: ExpandedImage,
    width: number,
    className?: string,
}

/**
 * A committee logo, drawn as a mask filled with a themeable colour when it is a vector.
 *
 * Both cases have to be handled and always will: committee logos are uploaded as svg, but a
 * committee with no logo of its own falls back to the DEFAULT_COMMITTEE_LOGO standard image, and the
 * standard collection accepts every extension - so the fallback is raster today, and nothing
 * constrains it to be anything in particular later. `type` is the only trustworthy signal.
 *
 * Anything that is not a vector is rendered as an ordinary image, which is what it has always been.
 */
export default function CommitteeLogo({ logoImage, width, className }: PropTypes) {
    if (logoImage.type !== 'SVG') {
        return <Image className={className} image={logoImage} width={width} />
    }

    // fallback case in case committee logo is not an svg.
    return (
        <div
            className={`
                aspect-square mask-(--committee-logo-mask) mask-contain mask-no-repeat mask-center
                bg-[var(--committee-logo-color,var(--text))]
                ${className ?? ''}
            `}
            // The mask url is set from here rather than the stylesheet because it differs per
            // committee. fsLocationOriginal is a server-generated uuid, so it cannot break out of
            // the url(). Everything else about the mask lives in the stylesheet.
            style={{
                width: `${width}px`,
                '--committee-logo-mask': `url('${imageSourceForResolution(logoImage, 'ORIGINAL')}')`,
            } as CSSProperties}
            role="img"
            aria-label={logoImage.alt}
        />
    )
}
