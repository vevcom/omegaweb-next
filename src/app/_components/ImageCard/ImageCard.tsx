import Image from '@/components/Image/Image'
import Link from 'next/link'
import type { ExpandedImage } from '@/services/images/subservice/types'
import type { ReactNode } from 'react'

type PropTypes = {
    image: ExpandedImage | null,
    title: string,
    children?: ReactNode,
    href: string,
    className?: string
}

export default function ImageCard({ image, title, children, href, className }: PropTypes) {
    return (
        <Link href={href} className={`
            min-w-[200px] max-w-[400px] rounded-round relative text-base-content no-underline flex flex-col isolate
            overflow-hidden bg-base-200 hover:bg-base-300 transition-colors transition-300 m-2
            max-mobile:m-0
            ${className}
        `}>
            <div className="
                relative shrink-0 w-full h-[160px] overflow-hidden
                [&>*]:size-full [&>*]:object-cover
                [&>*_img]:size-full [&>*_img]:object-cover
            ">
                {
                    image && (
                        <Image
                            disableLinkingToLicense
                            creditPlacement="top"
                            width={240}
                            sizes="400px"
                            image={image}
                        />
                    )
                }
            </div>
            <div className="
                flex-auto p-4
                [&>h2]:text-xl [&>h2]:wrap-anywhere [&>h2]:mb-1
                [&>p]:text-base-content/80 [&>p]:line-clamp-3
            ">
                <h2 className='text-base-content'>{title}</h2>
                {children}
            </div>
        </Link>
    )
}
