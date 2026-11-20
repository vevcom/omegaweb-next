'use client'
import Form from '@/components/Form/Form'
import FileInput from '@/components/UI/FileInput'
import { destroyChatPictureAction, updateChatPictureAction } from '@/services/chat/users/actions'
import { configureAction } from '@/services/configureAction'
import { useId, useState } from 'react'
import type { ActionFormData } from '@/services/actionTypes'

type PropTypes = {
    userId: number,
    hasOwnPicture: boolean,
}

/**
 * The forms that give the user's account on the chat a picture of its own, and take that away.
 * What a form did is said in a line that is read out, which is how a screen reader is told of it.
 */
export default function ChatPictureForms({ userId, hasOwnPicture }: PropTypes) {
    const ofUser = { params: { userId } }
    const fileFieldId = useId()
    const { outcome, telling } = useOutcome()

    return (
        <>
            <Form
                className="w-fit!"
                submitText="Last opp"
                action={telling('Chatbildet er lastet opp.', configureAction(updateChatPictureAction, ofUser))}
                refreshOnSuccess
            >
                <FileInput id={fileFieldId} label="Velg bilde" name="imageFile" color="primary" accept="image/*" />
            </Form>
            {hasOwnPicture && (
                <Form
                    className="w-fit!"
                    submitText="Fjern chatbildet"
                    submitColor="red"
                    action={telling('Chatbildet er fjernet.', configureAction(destroyChatPictureAction, ofUser))}
                    // The button is gone once the picture is, and the focus would be lost with it.
                    successCallback={() => document.getElementById(fileFieldId)?.focus()}
                    refreshOnSuccess
                />
            )}
            <p role="status" className="sr-only">{outcome}</p>
        </>
    )
}

/**
 * What the form sent last did, in words. They are taken away while a form is sent, since only what
 * is new is read out, and an upload after an upload would say the same words again.
 */
function useOutcome() {
    const [outcome, setOutcome] = useState('')
    function telling<Data>(done: string, action: ActionFormData<Data>): ActionFormData<Data> {
        return async formData => {
            setOutcome('')
            const result = await action(formData)
            if (result.success) setOutcome(done)
            return result
        }
    }
    return { outcome, telling }
}
