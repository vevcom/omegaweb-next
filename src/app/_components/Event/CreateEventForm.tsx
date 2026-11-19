'use client'
import { SelectNumberPossibleNULL, SelectString } from '@/components/UI/Select'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import { createEventAction } from '@/services/events/actions'
import { eventLinks } from '@/pageKits/events/links'
import { eventKinds } from '@/services/events/kinds'
import { EventKind } from '@/prisma-generated-pn-types'
import type { EventPagesConfig } from '@/pageKits/events/config'
import type { Committee } from '@/prisma-generated-pn-types'

/**
 * Creates a draft from a kind and a name. The kind is that of the pages unless another is picked,
 * and is the one thing here that cannot be changed later. The rest is filled in on the event's
 * page, and is checked when it is published. The creator's own committee is offered as the host,
 * which then administrates the draft. Without one the draft is the creator's alone until it gets one.
 */
export default function CreateEventForm({ config, committees, defaultHostCommitteeId }: {
    /** The event pages the form is on, which link to the event once it is created. */
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
        navigateOnSuccess={data => (data?.name ? links.event(data) : links.list())}
    >
        <SelectString
            label="Type"
            name="kind"
            options={Object.values(EventKind).map(kind => ({ value: kind, label: eventKinds[kind].name }))}
            defaultValue={config.defaultKind}
        />
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
    </Form>
}
