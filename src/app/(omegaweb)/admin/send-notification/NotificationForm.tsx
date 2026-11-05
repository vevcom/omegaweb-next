'use client'
import { SelectNumber } from '@/components/UI/Select'
import CreateNotificationForm from '@/components/Notifications/CreateNotificationForm'
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
            action={configureAction(createNotificationInManualChannelAction, { params: { channelId } })}
        />
    </>
}
