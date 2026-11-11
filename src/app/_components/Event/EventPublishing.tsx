'use client'
import Form from '@/components/Form/Form'
import { destroyEventAction, setEventPublishedAction } from '@/services/events/actions'
import { publishProblems } from '@/services/events/publishProblems'
import { configureAction } from '@/services/configureAction'
import { eventLinks } from '@/pageKits/events/links'
import type { CapabilitiesJsObject } from '@/auth/authorizer/capabilities'
import type { EventDetailed } from '@/services/events/types'
import type { VisibilityMatrix } from '@/services/visibility/types'
import type { EventPagesConfig } from '@/pageKits/events/config'

type PropTypes = {
    event: Pick<EventDetailed,
        'id' | 'published' | 'location' | 'eventStart' | 'eventEnd' | 'canBeViewedBy' | 'ledgerAccount' | 'variants'
    >,
    /** Who administrates the event, which it takes to publish it. */
    adminVisibility: VisibilityMatrix,
    config: EventPagesConfig,
    capabilities: CapabilitiesJsObject<'canSetPublished' | 'canDestroy'>,
}

const sectionClassName = `
    flex flex-col gap-3 p-4 rounded-round bg-base-200
    [&>h3]:m-0 [&>h3]:text-l [&>h3]:font-bold
    [&>p]:m-0
`

/** Publishing the event once it has what it needs, and deleting it. */
export default function EventPublishing({ event, adminVisibility, config, capabilities }: PropTypes) {
    const setPublished = configureAction(setEventPublishedAction, { params: { id: event.id } })
    const problems = publishProblems({ ...event, adminVisibility })

    return <div className="flex flex-col gap-4 min-w-0">
        <h2 className="m-0">Publisering</h2>

        {capabilities.canSetPublished.authorized && <section className={sectionClassName}>
            <p>
                {event.published
                    ? 'Arrangementet er publisert.'
                    : 'Arrangementet er et utkast som bare administratorene ser.'}
            </p>
            {!event.published && problems.length > 0 && <>
                <p className="font-medium">Dette mangler før det kan publiseres:</p>
                <ul className="m-0 pl-5">
                    {problems.map(problem => <li key={problem}>{problem}</li>)}
                </ul>
            </>}
            <Form
                action={() => setPublished({ data: { published: !event.published } })}
                refreshOnSuccess
                submitText={event.published ? 'Avpubliser' : 'Publiser'}
                submitColor={event.published ? 'red' : 'green'}
                disabled={!event.published && problems.length > 0}
                className="w-auto!"
            />
        </section>}

        {capabilities.canDestroy.authorized && <section className={sectionClassName}>
            <h3>Slett arrangementet</h3>
            <p>
                Arrangementet slettes med alle påmeldingene sine. Har noen betalt, må de meldes av først, så de
                får pengene tilbake.
            </p>
            <Form
                action={configureAction(destroyEventAction, { params: { id: event.id } })}
                navigateOnSuccess={eventLinks(config).list()}
                submitText="Slett arrangementet"
                submitColor="red"
                confirmation={{
                    confirm: true,
                    text: 'Er du sikker på at du vil slette dette arrangementet?'
                }}
            />
        </section>}
    </div>
}
