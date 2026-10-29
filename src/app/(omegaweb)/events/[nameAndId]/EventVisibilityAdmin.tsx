'use client'
import Form from '@/components/Form/Form'
import VisibilityAdmin from '@/components/Visibility/VisibilityAdmin/VisibilityAdmin'
import {
    setEventPublishedAction,
    updateEventAdminLevelVisibilityAction,
    updateEventRegularLevelVisibilityAction,
} from '@/services/events/actions'
import { eventAuth } from '@/services/events/auth'
import { configureAction } from '@/services/configureAction'
import { EMPTY_VISIBILITY } from '@/auth/visibility/emptyVisibility'
import useAuthorizer from '@/hooks/useAuthorizer'
import type { DoubleLevelVisibilityMatrix } from '@/services/visibility/types'
import type { Event } from '@/prisma-generated-pn-types'

type PropTypes = {
    event: Event,
    doubleLevelVisibility: DoubleLevelVisibilityMatrix | null,
}

const sectionClassName = `
    flex flex-col gap-4 p-4 rounded-round layer
    [&>h3]:m-0 [&>h3]:text-l [&>h3]:font-bold
    [&>p]:m-0 [&>p]:text-s [&>p]:text-text-muted
`

/**
 * Whether the event is published and its two visibility levels - the tools only those who
 * administrate the event get to see.
 */
export default function EventVisibilityAdmin({ event, doubleLevelVisibility }: PropTypes) {
    const doubleLevelMatrix = doubleLevelVisibility ?? EMPTY_VISIBILITY

    const canUpdateRegularVisibility = useAuthorizer({
        authorizer: eventAuth.updateRegularLevel.data({ visibility: doubleLevelMatrix })
    }).authorized
    const canUpdateAdminVisibility = useAuthorizer({
        authorizer: eventAuth.updateAdminLevel.data({ visibility: doubleLevelMatrix })
    }).authorized
    const canSetPublished = useAuthorizer({
        authorizer: eventAuth.setPublished.data({ visibility: doubleLevelMatrix })
    }).authorized

    const setPublished = configureAction(setEventPublishedAction, { params: { id: event.id } })

    // The editors are bound to doubleLevelVisibility rather than doubleLevelMatrix on purpose:
    // saving the fallback would overwrite the real requirements with fabricated ones.
    const canEditVisibility = doubleLevelVisibility !== null &&
        (canUpdateRegularVisibility || canUpdateAdminVisibility)

    if (!canEditVisibility && !canSetPublished) return null

    return <div className="
        flex flex-col gap-4 min-w-[min(80vw,40rem)]
        [&>h2]:m-0
    ">
        <h2>Synlighet</h2>

        {canSetPublished && <section className={sectionClassName}>
            <h3>Publisering</h3>
            <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="m-0">
                    {event.published
                        ? 'Arrangementet er publisert.'
                        : 'Arrangementet er et utkast som bare administratorene ser.'}
                </p>
                <Form
                    action={() => setPublished({ data: { published: !event.published } })}
                    refreshOnSuccess
                    submitText={event.published ? 'Avpubliser' : 'Publiser'}
                    submitColor={event.published ? 'red' : 'green'}
                    className="w-auto!"
                />
            </div>
        </section>}

        {doubleLevelVisibility && canUpdateRegularVisibility && <section className={sectionClassName}>
            <h3>Hvem kan melde seg på</h3>
            <p>Uten krav kan alle melde seg på.</p>
            <VisibilityAdmin
                visibility={doubleLevelVisibility.regularLevel}
                visibilityId={event.visibilityRegularId}
                updateVisibilityAction={configureAction(
                    updateEventRegularLevelVisibilityAction,
                    { implementationParams: { id: event.id } }
                )}
            />
        </section>}

        {doubleLevelVisibility && canUpdateAdminVisibility && <section className={sectionClassName}>
            <h3>Hvem kan administrere</h3>
            <p>Uten krav kan bare de med rettigheten EVENT_ADMIN administrere arrangementet.</p>
            <VisibilityAdmin
                visibility={doubleLevelVisibility.adminLevel}
                visibilityId={event.visibilityAdminId}
                updateVisibilityAction={configureAction(
                    updateEventAdminLevelVisibilityAction,
                    { implementationParams: { id: event.id } }
                )}
            />
        </section>}
    </div>
}
