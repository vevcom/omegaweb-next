'use client'
import EditableTextField from '@/components/EditableTextField/EditableTextField'
import { updateEventAction } from '@/services/events/actions'
import { configureAction } from '@/services/configureAction'
import { formatVevenUri } from '@/lib/urlEncoding'
import useEditMode from '@/hooks/useEditMode'
import type { Event } from '@/prisma-generated-pn-types'
import type { CapabilitiesJsObject } from '@/auth/authorizer/capabilities'

type PropTypes = {
    event: Event,
    capabilities: CapabilitiesJsObject<'canUpdate'>,
}

export default function ShowAndEditName({ event, capabilities }: PropTypes) {
    const editable = useEditMode({ authResult: capabilities.canUpdate })
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
                className: 'translate-y-[-50px]'
            }}
        >
            <h1>{event.name}</h1>
        </EditableTextField>
    )
}
