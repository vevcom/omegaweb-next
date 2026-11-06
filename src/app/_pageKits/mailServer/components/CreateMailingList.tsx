'use client'
import OwnersField from './OwnersField'
import { mailServerLinks } from '@/pageKits/mailServer/links'
import { createMailingListAction } from '@/services/mail/list/actions'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import useSiteRouter from '@/hooks/useSiteRouter'
import { useState } from 'react'
import type { MailServerPagesConfig } from '@/pageKits/mailServer/config'
import type { VisibilityRequirement } from '@/services/visibility/types'

export default function CreateMailingList({ config }: { config: MailServerPagesConfig }) {
    const { push } = useSiteRouter()
    const links = mailServerLinks(config)
    const [ownerRequirements, setOwnerRequirements] = useState<VisibilityRequirement[]>([])

    return <Form
        title="Opprett ny e-postliste"
        submitText="Opprett"
        action={createMailingListAction}
        successCallback={data => {
            if (!data) return
            push(links.node('mailingList', data.id))
        }}
    >
        <TextInput label="Navn" name="name"></TextInput>
        <TextInput label="Beskrivelse" name="description"></TextInput>
        <OwnersField requirements={ownerRequirements} onChange={setOwnerRequirements} />
    </Form>
}
