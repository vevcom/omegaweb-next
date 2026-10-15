import Image from '@/components/Image/Image'
import Link from 'next/link'
import type { PromoWithImage } from '@/services/promo/types'

// Its own island, same as LoggedInSection, but a single fixed-height banner
// (14 * $gap = 112px) for the promo an admin has manually scheduled.
export default function PromoBar({ promo }: { promo: PromoWithImage }) {
    return (
        <Link
            href={promo.link}
            className={[
                'relative block w-full h-28 rounded-round overflow-hidden',
                '[color:unset] no-underline hover:no-underline',
            ].join(' ')}
        >
            {/* The ::after darkens the left side so the title/text stay legible over any photo. */}
            <div className={[
                'absolute inset-0 rounded-[inherit] overflow-hidden [&_div]:size-full',
                '[&_img]:absolute [&_img]:top-0 [&_img]:left-0 [&_img]:size-full [&_img]:object-cover',
                'after:absolute after:inset-0 after:bg-linear-90/srgb after:from-black/85 after:to-transparent after:to-65%',
            ].join(' ')}>
                <Image width={1200} image={promo.image} hideCredit hideCopyRight />
            </div>
            <div className="relative h-full flex flex-col justify-center gap-1 py-4 px-6 max-w-[70%]">
                <h3 className="text-l font-bold text-white truncate">{promo.title}</h3>
                <p className="text-s text-white text-ellipsis line-clamp-2">{promo.text}</p>
            </div>
        </Link>
    )
}
