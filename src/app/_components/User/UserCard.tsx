import UserDisplayName from './UserDisplayName'
import styles from './UserCard.module.scss'
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
        className={`${styles.UserCard} ${className ? className : ''}`}
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
