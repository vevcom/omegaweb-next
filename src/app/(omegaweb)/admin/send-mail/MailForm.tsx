'use client'
import { sendMailAction, sendMailFromAliasAction } from '@/services/notifications/sendMail/actions'
import { configureAction } from '@/services/configureAction'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import Textarea from '@/components/UI/Textarea'
import { SelectNumber } from '@/components/UI/Select'
import MultiSearchableDropdown from '@/components/UI/MultiSearchableDropdown'
import { useState } from 'react'
import type { CapabilitiesJsObject } from '@/auth/authorizer/capabilities'
import type { MailAlias, MailingList } from '@/prisma-generated-pn-types'

type PropTypes = {
    /** The aliases the sender may send from. */
    aliases: MailAlias[],
    mailingLists: MailingList[],
    /** The alias picked from the start, when the sender came from its page. */
    fromAliasId: number | null,
    capabilities: CapabilitiesJsObject<'canSendFromAnyAddress'>,
}

export default function MailForm({ aliases, mailingLists, fromAliasId, capabilities }: PropTypes) {
    const [successMessage, setSuccessMessage] = useState<string | null>(null)

    // A typed address, which only those who may send from any address get a field for, wins over the alias picked.
    const send = (formData: FormData) => {
        const typedFrom = formData.get('from')
        if (typeof typedFrom === 'string' && typedFrom.trim()) return sendMailAction(formData)
        const aliasId = Number(formData.get('fromAliasId'))
        return configureAction(sendMailFromAliasAction, { params: { aliasId } })(formData)
    }

    return <>
        <Form
            action={send}
            submitText="Send e-post"
            className="w-full"
            buttonClassName="max-w-[300px] w-full!"
            successCallback={data => setSuccessMessage(data ? `Sendt til ${data.recipientCount} mottakere.` : null)}
        >
            {aliases.length > 0 && (
                <SelectNumber
                    name="fromAliasId"
                    label="Avsender"
                    options={aliases.map(alias => ({ value: alias.id, label: alias.address }))}
                    defaultValue={fromAliasId ?? aliases[0].id}
                />
            )}
            {capabilities.canSendFromAnyAddress.authorized && (
                <TextInput name="from" label={aliases.length > 0 ? 'Annen avsenderadresse (valgfritt)' : 'Avsender'} />
            )}
            <Textarea name="recipients" label="Mottakere (skill adressene med komma eller linjeskift)" />
            {mailingLists.length > 0 && (
                <MultiSearchableDropdown
                    name="mailingListIds"
                    label="E-postlister"
                    options={mailingLists.map(list => ({ value: list.id, label: list.name }))}
                />
            )}
            <TextInput name="subject" label="Emne"/>

            <Textarea name="text" label="Melding" className="[&>textarea]:min-h-[200px]"/>

            <p>
                Hver mottaker får sin egen e-post, så ingen ser hvem andre som har fått den. Du kan gjøre
                e-posten personlig med kodene under, som byttes ut for hver mottaker. Adresser som ikke hører
                til brukere på veven (f.eks. eksterne adresser og aliaser) har ingen navn, så da blir kodene stående tomme.
            </p>
            <table>
                <tbody>
                    <tr>
                        <th>%n</th>
                        <td>Fornavn</td>
                    </tr>
                    <tr>
                        <th>%N</th>
                        <td>Fullt navn</td>
                    </tr>
                    <tr>
                        <th>%u</th>
                        <td>Brukernavn</td>
                    </tr>
                </tbody>
            </table>
        </Form>
        {successMessage && <p>{successMessage}</p>}
    </>
}
