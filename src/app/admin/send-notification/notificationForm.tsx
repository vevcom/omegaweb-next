'use client'
import styles from './notificaionForm.module.scss'
import { SelectNumber } from '@/components/UI/Select'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import Textarea from '@/components/UI/Textarea'
import { createNotificationAction } from '@/services/notifications/actions'
import { useState } from 'react'
import type { ExpandedNotificationChannel } from '@/services/notifications/types'


export default function NotificationForm({
    channels,
}: {
    channels: ExpandedNotificationChannel[]
}) {
    const [successMessage, setSuccessMessage] = useState<string | null>(null)

    return <>
        <Form
            submitText="Send varsel"
            className={styles.notificaionForm}
            action={createNotificationAction}
            successCallback={data => {
                if (data) {
                    setSuccessMessage(`
                        Varslingen er lagt til i køen.
                        Det kan ta ganske lang tid før alle får varselet
                    `)
                }
            }}
        >
            <SelectNumber
                name="channelId"
                options={channels.map(channel => ({
                    value: channel.id,
                    label: channel.name,
                }))}
                className={styles.select}
                label="Varslingskanal"
            />

            <TextInput name="title" label="Tittel" />
            <Textarea name="message" label="Melding" className={styles.textArea} />

            <p>
                Dersom du ønsker å gjøre varselet mer personlig kan man bruke brukerinformasjon i varselet.
                Under er en liste med kommandoer. Dersom det kun er e-post varslingere så kan du skrive i markdown.
            </p>
            <table>
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
            </table>

        </Form>
        {successMessage && <p>{successMessage}</p>}
    </>
}
