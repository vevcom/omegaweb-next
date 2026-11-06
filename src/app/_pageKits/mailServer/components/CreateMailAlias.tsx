'use client'
import OwnersField from './OwnersField'
import { mailServerLinks } from '@/pageKits/mailServer/links'
import { createMailAliasAction } from '@/services/mail/alias/actions'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import { SelectString } from '@/components/UI/Select'
import useSiteRouter from '@/hooks/useSiteRouter'
import { useState } from 'react'
import type { MailServerPagesConfig } from '@/pageKits/mailServer/config'
import type { VisibilityRequirement } from '@/services/visibility/types'

export default function CreateMailAlias({
    config,
    domains,
    defaultDomain,
}: {
    config: MailServerPagesConfig,
    domains: string[],
    defaultDomain: string,
}) {
    const { push } = useSiteRouter()
    const links = mailServerLinks(config)
    const [ownerRequirements, setOwnerRequirements] = useState<VisibilityRequirement[]>([])

    return <Form
        title="Opprett nytt alias"
        submitText="Opprett"
        action={createMailAliasAction}
        successCallback={(data) => {
            if (!data) return
            push(links.node('alias', data.id))
        }}
    >
        <TextInput label="Alias" name="localPart" />
        <SelectString
            label="Domene"
            name="domain"
            options={domains.map(domain => ({ value: domain, label: `@${domain}` }))}
            defaultValue={defaultDomain}
        />
        <TextInput label="Beskrivelse" name="description" />
        <OwnersField requirements={ownerRequirements} onChange={setOwnerRequirements} />
    </Form>
}
