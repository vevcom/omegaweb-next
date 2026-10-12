'use client'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import { SelectNumber } from '@/components/UI/Select'
import NotificationMethodSelector from '@/components/NotificationMethodSelector/NotificationMethodSelector'
import { booleanOperationOnMethods } from '@/services/notifications/methods/helpers'
import { createNotificationChannelAction } from '@/services/notifications/channel/actions'
import { allNotificationMethodsOff, allNotificationMethodsOn } from '@/services/notifications/constants'
import { configureAction } from '@/services/configureAction'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ExpandedNotificationChannel, NotificationMethodGeneral } from '@/services/notifications/types'

type PropTypes = {
    channels: ExpandedNotificationChannel[]
}

export default function AddNotificationChannel({ channels }: PropTypes) {
    const { push } = useRouter()

    const [availableMethods, setAvailableMethods] = useState<NotificationMethodGeneral>(allNotificationMethodsOn)
    const [defaultMethods, setDefaultMethods] = useState<NotificationMethodGeneral>(allNotificationMethodsOn)
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
        action={configureAction(createNotificationChannelAction, {
            params: {
                availableMethods,
                defaultMethods,
            }
        })}
        successCallback={(data?: ExpandedNotificationChannel) => {
            if (data) {
                push(`notification-channels/${data.id}`)
            }
        }}
    >
        <TextInput name="name" label="Navn" />
        <TextInput name="description" label="Beskrivelse" />

        <SelectNumber
            label="Forelder"
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

        <NotificationMethodSelector
            formPrefix="defaultMethods"
            title="Standard metoder"
            methods={defaultMethods}
            editable={booleanOperationOnMethods(editableMethods, availableMethods, 'AND')}
            onChange={setDefaultMethods}
        />

    </Form>
}
