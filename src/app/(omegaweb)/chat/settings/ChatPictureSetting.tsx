import ChatPictureForms from './ChatPictureForms'
import ProfilePicture from '@/components/User/ProfilePicture'
import type { ChatPicture } from '@/services/chat/users/picture'
import type { ExpandedImage } from '@/services/images/subservice/types'

type PropTypes = {
    userId: number,
    picture: ChatPicture<ExpandedImage> | null,
}

const whereThePictureIsFrom = {
    OWN: 'Kontoen din på chatten har et eget bilde.',
    PROFILE: 'Kontoen din på chatten har profilbildet ditt.',
    NONE: 'Kontoen din på chatten har ikke noe bilde, siden du ikke har noe profilbilde.',
} as const

/** The picture the user's account has on the chat, with the forms that give it one of its own and take that away. */
export default function ChatPictureSetting({ userId, picture }: PropTypes) {
    return (
        <>
            <p className="m-0">
                {whereThePictureIsFrom[picture?.source ?? 'NONE']} Alle på chatten ser bildet, også når det er
                profilbildet ditt. Det kan ta litt tid før chatten viser et nytt bilde.
            </p>
            <div className="flex flex-wrap items-start gap-4">
                {picture && <ProfilePicture profileImage={picture.image} width={160} />}
                <ChatPictureForms userId={userId} hasOwnPicture={picture?.source === 'OWN'} />
            </div>
        </>
    )
}
