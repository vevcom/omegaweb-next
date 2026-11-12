'use client'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import { SelectString } from '@/components/UI/Select'
import type { ActionFormData } from '@/services/actionTypes'
import type { MailAddress } from '@/prisma-generated-pn-types'

type PropTypes = {
    /** The operation of the service that has the address which moves it, with its params filled in. */
    action: ActionFormData<MailAddress>,
    address: string,
    /** The domains an address may be on. */
    domains: string[],
}

/** Moves an address of ours: what stands before the @, and which of our domains it is on. */
export default function MailAddressForm({ action, address, domains }: PropTypes) {
    const [localPart, domain] = address.split('@')
    // An address on a domain that has since left the config stays editable as it is.
    const domainOptions = domains.includes(domain) ? domains : [domain, ...domains]

    return <Form title="Endre adresse" submitText="Oppdater" action={action} refreshOnSuccess>
        <TextInput name="localPart" label="Adresse" defaultValue={localPart} />
        <SelectString
            name="domain"
            label="Domene"
            options={domainOptions.map(option => ({ value: option, label: `@${option}` }))}
            defaultValue={domain}
        />
    </Form>
}
