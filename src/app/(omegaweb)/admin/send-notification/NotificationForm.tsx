'use client'
import { SelectNumber } from '@/components/UI/Select'
import CreateNotificationForm from '@/components/Notifications/CreateNotificationForm'
import VisibilityMatrixEditor from '@/components/Visibility/VisibilityMatrixEditor/VisibilityMatrixEditor'
import { createNotificationInManualChannelAction } from '@/services/notifications/channels/manual/actions'
import { configureAction } from '@/services/configureAction'
import { useState } from 'react'
import type { ExpandedNotificationChannel } from '@/services/notifications/types'

export default function NotificationForm({
    channels,
}: {
    channels: ExpandedNotificationChannel[]
}) {
    const [channelId, setChannelId] = useState(channels[0]?.id)

    /** The editor posts the requirements alone, and the action takes them as the audience's. */
    const send = (formData: FormData) => {
        const posted = formData.get('audienceRequirements')
        const requirements = JSON.parse(typeof posted === 'string' ? posted : '[]') as unknown
        formData.delete('audienceRequirements')
        formData.set('audience', JSON.stringify({ requirements }))
        return configureAction(createNotificationInManualChannelAction, { params: { channelId } })(formData)
    }

    if (channelId === undefined) return <p>Det finnes ingen kanaler å sende varsler i. Lag en under varslingskanaler.</p>

    return <>
        <SelectNumber
            name="channelId"
            value={channelId}
            onChange={setChannelId}
            options={channels.map(channel => ({
                value: channel.id,
                label: channel.name,
            }))}
            className="max-w-[20rem]"
            label="Varslingskanal"
        />
        <CreateNotificationForm
            key={channelId}
            action={send}
            audienceField={<div className="flex flex-col gap-2">
                <h3 className="m-0">Mottakere</h3>
                <p className="m-0 text-base-content/80 text-[0.9rem]">
                    Varselet går til de som abonnerer på kanalen. Legg til krav for å nå bare noen av dem, for
                    eksempel medlemmene av en komité. Hvem som er med i gruppene, avgjøres når varselet sendes.
                </p>
                <VisibilityMatrixEditor name="audienceRequirements" verb="får varselet" everyone="Alle abonnenter" />
            </div>}
        />
    </>
}
