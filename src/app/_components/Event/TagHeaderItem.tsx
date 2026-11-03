import { TagHeasderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import PopUpProvider from '@/contexts/PopUp'
import EventTagsAdmin from '@/components/Event/EventTagsAdmin'
import React from 'react'
import type { EventTag } from '@/prisma-generated-pn-types'
import type { Capabilities } from '@/auth/authorizer/capabilities'
import type { EventPagesConfig } from '@/pageKits/events/config'

type PropTypes = {
    eventTags: EventTag[],
    currentTags: EventTag[]
    capabilities: Capabilities<'canCreateTags' | 'canUpdateTags' | 'canDestroyTags'>
    config: EventPagesConfig
    /** Whether the tags filter the archive rather than the coming events. */
    archive?: boolean
}

export default function TagHeaderItem({
    eventTags,
    currentTags,
    capabilities,
    config,
    archive = false,
}: PropTypes) {
    return (
        <TagHeasderItemPopUp scale={35} popUpKey="TagEventPopUp">
            <PopUpProvider>
                <EventTagsAdmin
                    capabilities={capabilities}
                    eventTags={eventTags}
                    selectedTags={currentTags}
                    config={config}
                    archive={archive}
                />
            </PopUpProvider>
        </TagHeasderItemPopUp>
    )
}
