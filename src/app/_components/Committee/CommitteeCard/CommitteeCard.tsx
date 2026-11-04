import CommitteeLogo from '@/components/Committee/CommitteeLogo/CommitteeLogo'
import SiteLink from '@/components/SiteLink/SiteLink'
import type { ExpandedImage } from '@/services/images/subservice/types'
import type { ReactNode } from 'react'
import type { AppHref } from '@/lib/sites/href'

type PropTypes = {
    image: ExpandedImage | null,
    title: string,
    children?: ReactNode,
    href: AppHref
}

export default function CommitteeCard({ image, title, children, href }: PropTypes) {
    return (
        <div className="
            w-full rounded-round bg-surface-base flex flex-col gap-2 p-2 transition-[background-color] duration-300
            hover:bg-surface-raised
        ">
            <SiteLink href={href} className="flex flex-row items-center gap-4 text-inherit no-underline text-left">
                <div className="
                    size-[128px] shrink-0 rounded-inner bg-surface-hover p-2 grid place-items-center
                    [&>*]:size-full! [&>*]:object-contain
                    [&>*_img]:size-full [&>*_img]:object-contain
                ">
                    {
                        image && (
                            <CommitteeLogo width={128} logoImage={image} />
                        )
                    }
                </div>
                {/* Long names are hyphenated, or broken anywhere when no hyphenation fits. */}
                <div className="
                    min-w-0
                    [&>h2]:text-l [&>h2]:font-bold [&>h2]:text-ink-strong [&>h2]:hyphens-auto [&>h2]:wrap-anywhere
                ">
                    <h2>{title}</h2>
                    {children}
                </div>
            </SiteLink>
        </div>
    )
}
