'use client'
import { sendMailFromAliasAction } from '@/services/notifications/sendMail/actions'
import { configureAction } from '@/services/configureAction'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import Textarea from '@/components/UI/Textarea'
import { SelectNumber } from '@/components/UI/Select'
import MultiSearchableDropdown from '@/components/UI/MultiSearchableDropdown'
import { useState } from 'react'
import type { MailAlias, MailingList } from '@/prisma-generated-pn-types'

type PropTypes = {
    /** The aliases the sender may send from. */
    aliases: MailAlias[],
    mailingLists: MailingList[],
    /** The alias picked from the start, when the sender came from its page. */
    fromAliasId: number | null,
}

export default function MailForm({ aliases, mailingLists, fromAliasId }: PropTypes) {
    const [successMessage, setSuccessMessage] = useState<string | null>(null)

    const send = (formData: FormData) => {
        const aliasId = Number(formData.get('fromAliasId'))
        return configureAction(sendMailFromAliasAction, { params: { aliasId } })(formData)
    }

    if (aliases.length === 0) {
        return <p>
            Du eier ingen alias å sende fra. E-post sendes fra et alias du er blant eierne av, så be
            eierne av aliaset om å ta deg med, eller en administrator av e-posttjeneren om å sende.
        </p>
    }

    return <>
        <Form
            action={send}
            submitText="Send e-post"
            className="w-full"
            buttonClassName="max-w-[300px] w-full!"
            successCallback={data => setSuccessMessage(data ? `Sendt til ${data.recipientCount} mottakere.` : null)}
        >
            <SelectNumber
                name="fromAliasId"
                label="Avsender"
                options={aliases.map(alias => ({ value: alias.id, label: alias.address }))}
                defaultValue={fromAliasId ?? aliases[0].id}
            />
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
