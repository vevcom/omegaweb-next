import EventLocationMap from './EventLocationMap'
import CmsParagraph from '@/components/Cms/CmsParagraph/CmsParagraph'
import { updateEventParagraphContentAction } from '@/services/events/actions'
import { configureAction } from '@/services/configureAction'
import type { CmsParagraph as CmsParagraphT } from '@/prisma-generated-pn-types'
import type { Capabilities } from '@/auth/authorizer/capabilities'

type PropTypes = {
    event: { id: number, paragraph: CmsParagraphT, locationMap: unknown },
    capabilities: Capabilities<'canEdit'>,
}

/**
 * The description of an event, editable in place by those who may, and the map to it when it has
 * one.
 */
export default function EventDescription({ event, capabilities }: PropTypes) {
    return (
        <>
            <CmsParagraph
                capabilities={capabilities}
                cmsParagraph={event.paragraph}
                updateCmsParagraphAction={
                    configureAction(updateEventParagraphContentAction, { implementationParams: { eventId: event.id } })
                }
            />
            {event.locationMap ? <section aria-label="Kart til arrangementet">
                <h2>Her finner du oss</h2>
                <EventLocationMap locationMap={event.locationMap} />
            </section> : null}
        </>
    )
}
