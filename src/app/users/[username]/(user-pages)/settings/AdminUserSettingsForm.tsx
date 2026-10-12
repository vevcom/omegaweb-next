'use client'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import { configureAction } from '@/services/configureAction'
import { updateUserAction } from '@/services/users/actions'
import type { UserBasic } from '@/services/users/types'

type PropTypes = {
    user: UserBasic,
}

/**
 * What only a user administrator may change about a user: the name, and the username the user is
 * known by across the site.
 */
export default function AdminUserSettingsForm({ user }: PropTypes) {
    const updateUser = configureAction(updateUserAction, { params: { id: user.id } })

    return (
        <Form
            title="Brukerinnstillinger (admin)"
            submitText="Lagre"
            action={updateUser}
            refreshOnSuccess
            // The page lives under the username, so a new one moves it.
            navigateOnSuccess={data => (data ? `/users/${data.username}/settings` : null)}
        >
            <TextInput label="Fornavn" name="firstname" defaultValue={user.firstname} />
            <TextInput label="Etternavn" name="lastname" defaultValue={user.lastname} />
            <TextInput label="Brukernavn" name="username" defaultValue={user.username} />
        </Form>
    )
}
