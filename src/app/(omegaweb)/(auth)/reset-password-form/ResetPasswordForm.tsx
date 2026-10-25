'use client'
import { resetPasswordAction } from '@/services/auth/actions'
import { configureAction } from '@/services/configureAction'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'

type PropTypes = {
    token: string
}

export default function ResetPasswordForm({ token }: PropTypes) {
    return <Form
        title="Nullstill passord"
        submitText="Endre passord"
        action={configureAction(resetPasswordAction, { params: { token } })}
        navigateOnSuccess="/login"
    >
        <TextInput name="password" type="password" label="Passord" />
        <TextInput name="confirmPassword" type="password" label="Bekreft passord" />
    </Form>
}
