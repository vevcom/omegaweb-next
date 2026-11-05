'use client'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import Textarea from '@/components/UI/Textarea'
import { SelectString } from '@/components/UI/Select'
import { useState } from 'react'
import type { ActionFormData } from '@/services/actionTypes'
import type { NotificationResult } from '@/services/notifications/types'
import type { AppHref } from '@/lib/sites/href'
import type { z } from 'zod'
import type { notificationChannelSchemas } from '@/services/notifications/channels/subservice/schemas'

type Audience = NonNullable<z.input<typeof notificationChannelSchemas.data.createNotification>['audience']>

/**
 * Creates a notification in a channel through the action given, bound to the channel by whoever
 * renders it. The audience is picked from the options given, or left open without any.
 */
export default function CreateNotificationForm({
    action,
    audienceOptions,
    defaultUrl,
}: {
    action: ActionFormData<NotificationResult>,
    audienceOptions?: { label: string, audience: Audience }[],
    defaultUrl?: AppHref,
}) {
    const [successMessage, setSuccessMessage] = useState<string | null>(null)

    return <>
        <Form
            submitText="Send varsel"
            className="w-full"
            action={action}
            successCallback={() => setSuccessMessage(
                'Varslingen er lagt til i køen. Det kan ta ganske lang tid før alle får varselet.'
            )}
        >
            {audienceOptions && <SelectString
                name="audience"
                label="Til"
                options={audienceOptions.map(option => ({ value: JSON.stringify(option.audience), label: option.label }))}
                className="max-w-[20rem]"
            />}
            <TextInput name="title" label="Tittel" />
            <Textarea name="message" label="Melding" className="max-h-[500px] h-[200px]" />
            <TextInput name="url" label="Lenke (valgfri)" defaultValue={defaultUrl} />
            <p>
                Lenken er en sti på nettsiden, for eksempel /events. Push-varselet åpner den når man trykker på
                det, og e-postene lenker til den.
            </p>

            <p>
                Vil du gjøre varselet mer personlig, kan du bruke brukerinformasjon i det.
                Under er en liste med kommandoer. Sendes varselet bare som e-post, kan du skrive i Markdown.
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
