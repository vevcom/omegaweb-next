'use client'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import { configureAction } from '@/services/configureAction'
import { updateUserProfileAction } from '@/services/users/actions'

type PropTypes = {
    username: string
    mobile: string | null
    allergies: string | null
}

export default function ContactInfoForm({ username, mobile, allergies }: PropTypes) {
    return (
        <Form
            action={configureAction(updateUserProfileAction, { params: { username } })}
            submitText="Lagre"
            refreshOnSuccess
        >
            <TextInput name="mobile" label="Mobilnummer" defaultValue={mobile ?? ''} />
            <TextInput name="allergies" label="Allergier og matpreferanser" defaultValue={allergies ?? ''} />
        </Form>
    )
}
