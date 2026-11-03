import { TagHeasderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import PopUpProvider from '@/contexts/PopUp'
import EventTagsAdmin from '@/components/Event/EventTagsAdmin'
import React from 'react'
import type { EventTag } from '@/prisma-generated-pn-types'
import type { Capabilities } from '@/auth/authorizer/capabilities'

type PropTypes = {
    eventTags: EventTag[],
    currentTags: EventTag[]
    capabilities: Capabilities<'canCreateTags' | 'canUpdateTags' | 'canDestroyTags'>
    /** The list the tags filter: the events page or its archive. */
    basePath: string
}

export default function TagHeaderItem({
    eventTags,
    currentTags,
    capabilities,
    basePath
}: PropTypes) {
    return (
        <TagHeasderItemPopUp scale={35} popUpKey="TagEventPopUp">
            <PopUpProvider>
                <EventTagsAdmin
                    capabilities={capabilities}
                    eventTags={eventTags}
                    selectedTags={currentTags}
                    basePath={basePath}
                />
            </PopUpProvider>
        </TagHeasderItemPopUp>
    )
}
