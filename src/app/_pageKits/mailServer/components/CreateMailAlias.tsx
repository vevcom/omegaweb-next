'use client'
import { mailServerLinks } from '@/pageKits/mailServer/links'

import { createMailAliasAction } from '@/services/mail/alias/actions'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import useSiteRouter from '@/hooks/useSiteRouter'
import type { MailServerPagesConfig } from '@/pageKits/mailServer/config'


export default function CreateMailAlias({ config }: { config: MailServerPagesConfig }) {
    const { push } = useSiteRouter()
    const links = mailServerLinks(config)

    return <Form
        title="Opprett nytt alias"
        submitText="Opprett"
        action={createMailAliasAction}
        successCallback={(data) => {
            if (!data) return
            push(links.node('alias', data.id))
        }}
    >
        <TextInput label="Alias" name="address" />
        <TextInput label="Beskrivelse" name="description" />
    </Form>
}
