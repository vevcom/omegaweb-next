'use client'
import { createMailingListAction } from '@/services/mail/list/actions'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import useSiteRouter from '@/hooks/useSiteRouter'

export default function CreateMailingList() {
    const { push } = useSiteRouter()

    return <Form
        title="Opprett ny e-postliste"
        submitText="Opprett"
        action={createMailingListAction}
        successCallback={data => {
            if (!data) return
            push(`/admin/mail/mailingList/${data.id}`)
        }}
    >
        <TextInput label="Navn" name="name"></TextInput>
        <TextInput label="Beskrivelse" name="description"></TextInput>
    </Form>
}
