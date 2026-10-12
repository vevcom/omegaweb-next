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
    page: 'EVENT' | 'EVENT_ARCHIVE'
}

export default function TagHeaderItem({
    eventTags,
    currentTags,
    capabilities,
    page
}: PropTypes) {
    return (
        <TagHeasderItemPopUp scale={35} popUpKey="TagEventPopUp">
            <PopUpProvider>
                <EventTagsAdmin
                    capabilities={capabilities}
                    eventTags={eventTags}
                    selectedTags={currentTags}
                    page={page}
                />
            </PopUpProvider>
        </TagHeasderItemPopUp>
    )
}
