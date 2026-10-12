'use client'
import { createMailAddressExternalAction } from '@/services/mail/mailAddressExternal/actions'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import { useRouter } from 'next/navigation'


export default function CreateMailaddressExternal() {
    const { push } = useRouter()

    return <Form
        title="Opprett ny ekstern adresse"
        submitText="Opprett"
        action={createMailAddressExternalAction}
        successCallback={data => {
            if (!data) return
            push(`/admin/mail/mailaddressExternal/${data.id}`)
        }}
    >
        <TextInput label="Adresse" name="address"></TextInput>
        <TextInput label="Beskrivelse" name="description"></TextInput>
    </Form>
}
