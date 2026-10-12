'use client'

import { createMailAliasAction } from '@/services/mail/alias/actions'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import { useRouter } from 'next/navigation'


export default function CreateMailAlias() {
    const { push } = useRouter()

    return <Form
        title="Opprett nytt alias"
        submitText="Opprett"
        action={createMailAliasAction}
        successCallback={(data) => {
            if (!data) return
            push(`/admin/mail/alias/${data.id}`)
        }}
    >
        <TextInput label="Alias" name="address" />
        <TextInput label="Beskrivelse" name="description" />
    </Form>
}
