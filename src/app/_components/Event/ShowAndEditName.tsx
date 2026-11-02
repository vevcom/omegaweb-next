'use client'
import EditableTextField from '@/components/EditableTextField/EditableTextField'
import { updateEventAction } from '@/services/events/actions'
import { configureAction } from '@/services/configureAction'
import { eventLinks } from '@/pageKits/events/links'
import useEditMode from '@/hooks/useEditMode'
import type { Event } from '@/prisma-generated-pn-types'
import type { CapabilitiesJsObject } from '@/auth/authorizer/capabilities'
import type { EventPagesConfig } from '@/pageKits/events/config'

type PropTypes = {
    event: Event,
    /** The event pages to navigate into once saved, which differ between Omega's site and the career site. */
    config: EventPagesConfig,
    capabilities: CapabilitiesJsObject<'canUpdate'>,
}

export default function ShowAndEditName({ event, config, capabilities }: PropTypes) {
    const links = eventLinks(config)
    const editable = useEditMode({ authResult: capabilities.canUpdate })
    const updateAction = configureAction(updateEventAction, { params: { id: event.id } })

    return (
        <EditableTextField
            formProps={{
                action: updateAction,
                navigateOnSuccess: data => (data?.name ? links.event(data) : links.list()),
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
