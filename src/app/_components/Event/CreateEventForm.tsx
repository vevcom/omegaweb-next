'use client'
import { SelectNumberPossibleNULL } from '@/components/UI/Select'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import { createEventAction } from '@/services/events/actions'
import { eventLinks } from '@/pageKits/events/links'
import type { EventPagesConfig } from '@/pageKits/events/config'
import type { Committee } from '@/prisma-generated-pn-types'

/**
 * Creates a draft from nothing but a name. The rest is filled in on the event's page, and is
 * checked when it is published. The creator's own committee is offered as the host, which then
 * administrates the draft. Without one the draft is the creator's alone until it gets one.
 */
export default function CreateEventForm({ config, committees, defaultHostCommitteeId }: {
    /** The event pages to navigate into once created, which say the kind the event is created as. */
    config: EventPagesConfig,
    /** The committees to choose the host from, or null when they could not be read (they take COMMITTEE_USE). */
    committees: Committee[] | null,
    /** The creator's own committee among them, if any. */
    defaultHostCommitteeId: number | null,
}) {
    const links = eventLinks(config)

    return <Form
        title="Nytt arrangement"
        className="min-w-[min(80vw,28rem)]"
        action={createEventAction}
        submitText="Opprett utkast"
        navigateOnSuccess={data => links.event(data)}
    >
        <TextInput label="Navn" name="name" />
        {committees && <SelectNumberPossibleNULL
            label="Arrangeres av"
            name="hostedByCommitteeId"
            options={[
                { value: 'NULL', label: 'Ingen komité' },
                ...committees.map(committee => ({ value: committee.id, label: committee.name })),
            ]}
            defaultValue={defaultHostCommitteeId ?? 'NULL'}
        />}
        <input type="hidden" name="kind" value={config.defaultKind} />
    </Form>
}
