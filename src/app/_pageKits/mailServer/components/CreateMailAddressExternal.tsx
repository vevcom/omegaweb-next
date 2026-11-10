'use client'
import { mailServerLinks } from '@/pageKits/mailServer/links'
import { createMailAddressExternalAction } from '@/services/mail/mailAddressExternal/actions'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import useSiteRouter from '@/hooks/useSiteRouter'
import type { MailServerPagesConfig } from '@/pageKits/mailServer/config'


export default function CreateMailAddressExternal({ config }: { config: MailServerPagesConfig }) {
    const { push } = useSiteRouter()
    const links = mailServerLinks(config)

    return <Form
        title="Opprett ny ekstern adresse"
        submitText="Opprett"
        action={createMailAddressExternalAction}
        successCallback={data => {
            if (!data) return
            push(links.node('mailaddressExternal', data.id))
        }}
    >
        <TextInput label="Adresse" name="address"></TextInput>
        <TextInput label="Beskrivelse" name="description"></TextInput>
    </Form>
}
