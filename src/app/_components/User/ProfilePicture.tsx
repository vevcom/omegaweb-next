import Image from '@/components/Image/Image'
import type { ExpandedImage } from '@/services/images/subservice/types'

type PropTypes = {
    profileImage: ExpandedImage,
    width: number,
    className?: string,
    /** Draws a ring in this colour around the picture. Without it there is no ring. */
    ringColor?: string,
}

export default function ProfilePicture({ profileImage, width, className, ringColor }: PropTypes) {
    const isStandardProfileImage = profileImage.standardImage === 'DEFAULT_PROFILE_IMAGE'
    const imageClassName = [
        'rounded-full bg-white aspect-square',
        ringColor ? 'border-[3px] border-solid' : '',
        isStandardProfileImage ? 'object-contain p-[12%]' : 'object-cover',
        className ?? '',
    ].join(' ')

    return (
        <div className="flex justify-center">
            <Image
                className={imageClassName}
                style={ringColor ? { borderColor: ringColor } : undefined}
                image={profileImage}
                width={width}
            />
        </div>
    )
}
