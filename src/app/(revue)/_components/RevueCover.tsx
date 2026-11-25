import Image from '@/components/Image/Image'
import { scopedThemeProps } from '@/lib/theme'
import type { ThemeColors } from '@/lib/theme'
import type { ExpandedImage } from '@/services/images/subservice/types'
import type { ReactNode } from 'react'

type PropTypes = {
    image: ExpandedImage | null,
    year: number,
    /** Said before the year, as "Nyeste revy". */
    label?: string,
    /** The widest the cover is shown, which picks the image file. */
    imageWidth: number,
    /** The revue's theme, for a cover shown outside the revue's own pages. */
    colors?: ThemeColors,
    /** Whether the cover is inside a link, which then names it: its image is decoration and links to nothing. */
    insideLink?: boolean,
    className?: string,
    /** Laid over the image and its shade, under the text, as the cover image's editor. */
    editor?: ReactNode,
    children: ReactNode,
}

/**
 * A revue's cover with its text at the bottom. The image lies under a shade that keeps white text
 * readable on any image. Without an image it is a field of the revue's own colours with its year.
 */
export default function RevueCover({
    image,
    year,
    label,
    imageWidth,
    colors,
    insideLink = false,
    className = '',
    editor,
    children,
}: PropTypes) {
    return (
        <div {...(colors && scopedThemeProps(colors))} className={`
            @container relative isolate flex flex-col overflow-hidden rounded-round
            ${image ? 'bg-neutral text-white [text-shadow:0_1px_12px_rgb(0_0_0/0.7)]' : 'bg-base-200 text-base-content'}
            ${className}
        `}>
            {image && (
                <div className="absolute inset-0" aria-hidden={insideLink || undefined}>
                    <Image
                        image={image}
                        alt={image.alt}
                        width={imageWidth}
                        sizes={`(max-width: ${imageWidth}px) 100vw, ${imageWidth}px`}
                        creditPlacement="top"
                        disableLinkingToLicense={insideLink}
                        className="object-cover"
                        imageContainerClassName="size-full"
                    />
                </div>
            )}
            {image ? (
                <div className="
                    absolute inset-0 bg-linear-to-t from-black/85 via-black/60 via-60% to-black/10 pointer-events-none
                " />
            ) : (
                <span className="
                    relative self-end pt-[0.1em] pr-[0.1em] font-secondary text-[min(38cqw,14rem)] font-bold leading-[0.9]
                    text-primary select-none pointer-events-none
                ">
                    {year}
                </span>
            )}
            {editor && <div className="absolute inset-0 isolate">{editor}</div>}
            <div className="
                relative flex flex-col items-start gap-2 mt-auto p-[clamp(1rem,5cqw,2.5rem)] pointer-events-none
                [&>*]:pointer-events-auto
            ">
                {(label || image) && (
                    <span className="text-s font-semibold tracking-[0.2em] uppercase">
                        {[label, image ? year : null].filter(Boolean).join(' · ')}
                    </span>
                )}
                {children}
            </div>
        </div>
    )
}
