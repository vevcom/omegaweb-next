import ProfilePicture from '@/components/User/ProfilePicture'
import Form from '@/components/Form/Form'
import FileInput from '@/components/UI/FileInput'
import { destroyChatPictureAction, updateChatPictureAction } from '@/services/chat/users/actions'
import { configureAction } from '@/services/configureAction'
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
    const ofUser = { params: { userId } }
    return (
        <>
            <p className="m-0">{whereThePictureIsFrom[picture?.source ?? 'NONE']}</p>
            <div className="flex flex-wrap items-start gap-4">
                {picture && <ProfilePicture profileImage={picture.image} width={160} />}
                <Form
                    className="w-fit!"
                    submitText="Last opp"
                    action={configureAction(updateChatPictureAction, ofUser)}
                    refreshOnSuccess
                >
                    <FileInput label="Velg eget chatbilde" name="imageFile" color="primary" accept="image/*" />
                </Form>
                {picture?.source === 'OWN' && (
                    <Form
                        className="w-fit!"
                        submitText="Fjern chatbildet"
                        submitColor="red"
                        action={configureAction(destroyChatPictureAction, ofUser)}
                        refreshOnSuccess
                    />
                )}
            </div>
        </>
    )
}
