'use client'
import Form from '@/components/Form/Form'
import VisibilityAdmin from '@/components/Visibility/VisibilityAdmin/VisibilityAdmin'
import { setEventPublishedAction, updateEventAdminVisibilityAction } from '@/services/events/actions'
import { eventAuth } from '@/services/events/auth'
import { configureAction } from '@/services/configureAction'
import useAuthorizer from '@/hooks/useAuthorizer'
import type { EventAccess } from '@/services/events/types'
import type { Event } from '@/prisma-generated-pn-types'

type PropTypes = {
    event: Event,
    access: EventAccess,
    /** Whether the admin visibility could be read, so that the editor never saves a fallback over it. */
    adminVisibilityKnown: boolean,
}

const sectionClassName = `
    flex flex-col gap-4 p-4 rounded-round layer
    [&>h3]:m-0 [&>h3]:text-l [&>h3]:font-bold
    [&>p]:m-0 [&>p]:text-s [&>p]:text-text-muted
`

/**
 * Whether the event is published and who administrates it - the tools only those who administrate
 * the event get to see. Who may register is the quotas' business, in their own pop-up.
 */
export default function EventVisibilityAdmin({ event, access, adminVisibilityKnown }: PropTypes) {
    const canUpdateAdminVisibility = useAuthorizer({
        authorizer: eventAuth.updateAdminVisibility.data(access)
    }).authorized
    const canSetPublished = useAuthorizer({
        authorizer: eventAuth.setPublished.data(access)
    }).authorized

    const setPublished = configureAction(setEventPublishedAction, { params: { id: event.id } })

    if (!canUpdateAdminVisibility && !canSetPublished) return null

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

        {adminVisibilityKnown && canUpdateAdminVisibility && <section className={sectionClassName}>
            <h3>Hvem kan administrere</h3>
            <p>Uten krav kan bare de med rettigheten EVENT_ADMIN administrere arrangementet.</p>
            <VisibilityAdmin
                visibility={access.adminVisibility}
                visibilityId={event.visibilityAdminId}
                updateVisibilityAction={configureAction(
                    updateEventAdminVisibilityAction,
                    { implementationParams: { id: event.id } }
                )}
            />
        </section>}
    </div>
}
