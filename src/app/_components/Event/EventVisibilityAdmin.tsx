'use client'
import VisibilityAdmin from '@/components/Visibility/VisibilityAdmin/VisibilityAdmin'
import { updateEventAdminVisibilityAction } from '@/services/events/actions'
import { eventAuth } from '@/services/events/auth'
import { configureAction } from '@/services/configureAction'
import useAuthorizer from '@/hooks/useAuthorizer'
import type { EventAccess } from '@/services/events/types'

type PropTypes = {
    event: { id: number, visibilityAdminId: number },
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
 * Who administrates the event. Who may register is the quotas' business.
 */
export default function EventVisibilityAdmin({ event, access, adminVisibilityKnown }: PropTypes) {
    const canUpdateAdminVisibility = useAuthorizer({
        authorizer: eventAuth.updateAdminVisibility.data(access)
    }).authorized

    if (!canUpdateAdminVisibility) return null

    return <div className="
        flex flex-col gap-4 min-w-[min(80vw,40rem)]
        [&>h2]:m-0
    ">
        <h2>Tilgang</h2>

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
