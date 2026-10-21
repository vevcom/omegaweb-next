import UserDisplayName from './UserDisplayName'
import ProfilePicture from './ProfilePicture'
import Link from 'next/link'
import type { CSSProperties } from 'react'
import type { ExpandedImage } from '@/services/images/subservice/types'
import type { UserCard as UserCardData } from '@/services/users/types'

// TODO: Make nice and add picture
export default function UserCard({
    user,
    className,
    subText,
}: {
    user: UserCardData & {
        image: ExpandedImage
    },
    className?: string,
    subText?: string,
}) {
    const [topFlair] = [...user.flairs].sort((flairA, flairB) => flairA.rank - flairB.rank)

    return <Link
        className={`
            flex items-center gap-2 p-2 mx-2 mt-2 mb-0 box-border rounded-round no-underline text-text bg-surface-raised
            border-4 border-solid border-[var(--flairColor,var(--surface-raised))]
            [&>div>h6]:text-m
            [&>div>p]:text-s
            ${className ? className : ''}
        `}
        href={`/users/${user.username}`}
        style={topFlair ? {
            '--flairColor': `rgb(${topFlair.colorR}, ${topFlair.colorG}, ${topFlair.colorB})`,
        } as CSSProperties : undefined}
    >
        <ProfilePicture profileImage={user.image} width={60} />
        <div>
            <h6>
                <UserDisplayName user={user} width={18} />
            </h6>
            {subText && <p>{subText}</p>}
        </div>
    </Link>
}
