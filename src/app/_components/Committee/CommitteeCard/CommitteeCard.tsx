import CommitteeLogo from '@/components/Committee/CommitteeLogo/CommitteeLogo'
import Link from 'next/link'
import type { ExpandedImage } from '@/services/images/subservice/types'
import type { ReactNode } from 'react'

type PropTypes = {
    image: ExpandedImage | null,
    title: string,
    children?: ReactNode,
    href: string
}

export default function CommitteeCard({ image, title, children, href }: PropTypes) {
    return (
        <div className={[
            'w-full rounded-round bg-surface-base flex flex-col gap-2 p-2 transition-[background-color] duration-300',
            'hover:bg-surface-raised',
        ].join(' ')}>
            <Link href={href} className="flex flex-row items-center gap-4 text-inherit no-underline text-left">
                <div className={[
                    'size-[128px] shrink-0 rounded-inner bg-surface-hover p-2 grid place-items-center',
                    '[&>*]:size-full! [&>*]:object-contain [&>*_img]:size-full [&>*_img]:object-contain',
                ].join(' ')}>
                    {
                        image && (
                            <CommitteeLogo width={128} logoImage={image} />
                        )
                    }
                </div>
                <div className="[&>h2]:text-l [&>h2]:font-bold [&>h2]:text-ink-strong">
                    <h2>{title}</h2>
                    {children}
                </div>
            </Link>
        </div>
    )
}
