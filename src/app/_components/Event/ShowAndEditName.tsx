'use client'
import EditableTextField from '@/components/EditableTextField/EditableTextField'
import { updateEventAction } from '@/services/events/actions'
import { configureAction } from '@/services/configureAction'
import { eventHref } from '@/components/Event/Pages/eventPages'
import useEditMode from '@/hooks/useEditMode'
import type { Event } from '@/prisma-generated-pn-types'
import type { CapabilitiesJsObject } from '@/auth/authorizer/capabilities'

type PropTypes = {
    event: Event,
    /** The event pages the name links under once saved, which differ between Omega's site and the career site. */
    basePath: string,
    capabilities: CapabilitiesJsObject<'canUpdate'>,
}

export default function ShowAndEditName({ event, basePath, capabilities }: PropTypes) {
    const editable = useEditMode({ authResult: capabilities.canUpdate })
    const updateAction = configureAction(updateEventAction, { params: { id: event.id } })

    return (
        <EditableTextField
            formProps={{
                action: updateAction,
                navigateOnSuccess: data => (data?.name ? eventHref(basePath, data) : basePath),
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
