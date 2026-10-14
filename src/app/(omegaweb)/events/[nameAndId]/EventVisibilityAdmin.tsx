'use client'
import styles from './EventVisibilityAdmin.module.scss'
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

/**
 * The two visibility levels of an event and whether it is published - the tools only those who
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

    return <div className={styles.EventVisibilityAdmin}>
        {canSetPublished && <div className={styles.publish}>
            <p>{event.published ? 'Publisert' : 'Ikke publisert'}</p>
            <Form
                action={() => setPublished({ data: { published: !event.published } })}
                refreshOnSuccess
                submitText={event.published ? 'Avpubliser' : 'Publiser'}
            />
        </div>}

        {doubleLevelVisibility && canUpdateRegularVisibility && <div>
            <h3>Hvem kan melde seg på</h3>
            <VisibilityAdmin
                visibility={doubleLevelVisibility.regularLevel}
                visibilityId={event.visibilityRegularId}
                updateVisibilityAction={configureAction(
                    updateEventRegularLevelVisibilityAction,
                    { implementationParams: { id: event.id } }
                )}
            />
        </div>}

        {doubleLevelVisibility && canUpdateAdminVisibility && <div>
            <h3>Hvem kan administrere</h3>
            <VisibilityAdmin
                visibility={doubleLevelVisibility.adminLevel}
                visibilityId={event.visibilityAdminId}
                updateVisibilityAction={configureAction(
                    updateEventAdminLevelVisibilityAction,
                    { implementationParams: { id: event.id } }
                )}
            />
        </div>}
    </div>
}
