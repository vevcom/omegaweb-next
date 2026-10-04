'use client'
import styles from './ShowAndEditName.module.scss'
import EditableTextField from '@/components/EditableTextField/EditableTextField'
import { updateEventAction } from '@/services/events/actions'
import { configureAction } from '@/services/configureAction'
import { formatVevenUri } from '@/lib/urlEncoding'
import type { Event } from '@/prisma-generated-pn-types'

type PropTypes = {
    event: Event,
    editable: boolean,
}

export default function ShowAndEditName({ event, editable }: PropTypes) {
    const updateAction = configureAction(updateEventAction, { params: { id: event.id } })

    return (
        <EditableTextField
            formProps={{
                action: updateAction,
                navigateOnSuccess: data => (data?.name
                    ? `/events/${formatVevenUri(data.name, data.id)}`
                    : '/events'),
            }}
            editable={editable}
            inputName="name"
            submitButton={{
                text: 'Lagre',
                className: styles.submitButton
            }}
        >
            <h1>{event.name}</h1>
        </EditableTextField>
    )
}
