'use client'
import { sendMailAction } from '@/services/notifications/sendMail/actions'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import Textarea from '@/components/UI/Textarea'
import MultiSearchableDropdown from '@/components/UI/MultiSearchableDropdown'
import { useState } from 'react'
import type { MailingList } from '@/prisma-generated-pn-types'

type PropTypes = {
    mailingLists: MailingList[],
}

export default function MailForm({ mailingLists }: PropTypes) {
    const [successMessage, setSuccessMessage] = useState<string | null>(null)

    return <>
        <Form
            action={sendMailAction}
            submitText="Send e-post"
            className="w-full"
            buttonClassName="max-w-[300px] w-full!"
            successCallback={data => setSuccessMessage(data ? `Sendt til ${data.recipientCount} mottakere.` : null)}
        >
            <TextInput name="from" label="Avsender"/>
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
