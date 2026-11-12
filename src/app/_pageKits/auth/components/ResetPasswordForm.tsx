'use client'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import type { ActionFormData } from '@/services/actionTypes'
import type { AppHref } from '@/lib/sites/href'

type PropTypes = {
    /** Sets the password, with the token of the link already given to it. Each kind of account has its own. */
    action: ActionFormData<unknown>,
    /** Where to go once the password is set. */
    navigateOnSuccess: AppHref,
    title?: string,
    submitText?: string,
}

export default function ResetPasswordForm({
    action,
    navigateOnSuccess,
    title = 'Nullstill passord',
    submitText = 'Endre passord',
}: PropTypes) {
    return <Form
        title={title}
        submitText={submitText}
        action={action}
        navigateOnSuccess={navigateOnSuccess}
    >
        <TextInput name="password" type="password" label="Passord" />
        <TextInput name="confirmPassword" type="password" label="Bekreft passord" />
    </Form>
}
