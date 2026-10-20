import ProfilePicture from './ProfilePicture'
import Link from 'next/link'
import type { ExpandedImage } from '@/services/images/subservice/types'

export default function ContactCard({
    name,
    image,
    className,
}: {
    name: string,
    image: ExpandedImage
    className?: string,
}) {
    return <Link
        className={[
            'flex items-center gap-2 p-2 mx-2 mt-2 mb-0 box-border rounded-round no-underline text-text bg-surface-raised border-4 border-solid border-[var(--flairColor,var(--surface-raised))] [&>div>h6]:text-m [&>div>p]:text-s',
            className ? className : '',
        ].join(' ')}
        href="#"
    >
        <ProfilePicture profileImage={image} width={60} />
        <h6>{name}</h6>
    </Link>
}
