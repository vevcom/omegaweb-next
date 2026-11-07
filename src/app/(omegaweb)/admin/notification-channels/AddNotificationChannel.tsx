'use client'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import { SelectNumber } from '@/components/UI/Select'
import NotificationMethodSelector from '@/components/NotificationMethodSelector/NotificationMethodSelector'
import { createManualNotificationChannelAction } from '@/services/notifications/channels/manual/actions'
import { allNotificationMethodsOff, allNotificationMethodsOn } from '@/services/notifications/constants'
import { configureAction } from '@/services/configureAction'
import useSiteRouter from '@/hooks/useSiteRouter'
import { appHref } from '@/lib/sites/href'
import { useState } from 'react'
import type { ExpandedNotificationChannel, NotificationMethodGeneral } from '@/services/notifications/types'

type PropTypes = {
    channels: ExpandedNotificationChannel[]
}

export default function AddNotificationChannel({ channels }: PropTypes) {
    const { push } = useSiteRouter()

    const [availableMethods, setAvailableMethods] = useState<NotificationMethodGeneral>(allNotificationMethodsOn)
    const [selectedParentId, setSelectedParentId] = useState(channels.find(channel => channel.special === 'ROOT')?.id)
    const [editableMethods, setEditableMethods] = useState(
        channels.find(channel => channel.id === selectedParentId)?.availableMethods ?? allNotificationMethodsOn
    )

    function handleNewParent(id: number) {
        setSelectedParentId(id)
        setEditableMethods(channels.find(channel => channel.id === id)?.availableMethods ?? allNotificationMethodsOff)
    }

    return <Form
        title="Legg til varslingskanal"
        submitText="Legg til"
        action={configureAction(createManualNotificationChannelAction, {
            params: {
                availableMethods,
            }
        })}
        successCallback={(data?: ExpandedNotificationChannel) => {
            if (data) {
                push(appHref(`/admin/notification-channels/${data.id}`))
            }
        }}
    >
        <TextInput name="name" label="Navn" />
        <TextInput name="description" label="Beskrivelse" />

        <SelectNumber
            label="Overordnet kanal"
            name="parentId"
            options={channels.map(channel => ({ value: channel.id, label: channel.name }))}
            value={selectedParentId}
            onChange={handleNewParent}
        />

        <NotificationMethodSelector
            formPrefix="availableMethods"
            title="Tilgjengelige metoder"
            methods={availableMethods}
            editable={editableMethods}
            onChange={setAvailableMethods}
        />
    </Form>
}
