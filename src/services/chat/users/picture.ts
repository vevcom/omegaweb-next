import { imageProcessing } from '@/services/images/subservice/constants'

export type ChatPicture<Picture> = {
    image: Picture,
    source: 'OWN' | 'PROFILE',
}

type Image = { processedFiles: unknown, processingAttempts: number }

/** An image the image worker has given up on never gets the sizes it is shown in, so it counts as no image. */
const unlessGivenUpOn = <Picture extends Image>(image: Picture | null | undefined) => (
    image && (image.processedFiles || image.processingAttempts < imageProcessing.maxAttempts) ? image : null
)

export function chatPictureOf<Picture extends Image>({ image, user }: {
    image: Picture | null,
    user: { image: Picture | null } | null,
}): ChatPicture<Picture> | null {
    const own = unlessGivenUpOn(image)
    if (own) return { image: own, source: 'OWN' }
    const profile = unlessGivenUpOn(user?.image)
    if (profile) return { image: profile, source: 'PROFILE' }
    return null
}
