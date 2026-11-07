'use client'
import { SelectNumberPossibleNULL } from '@/components/UI/Select'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import { useSession } from '@/auth/session/useSession'
import { createEventAction } from '@/services/events/actions'
import { eventLinks } from '@/pageKits/events/links'
import { useState } from 'react'
import type { EventPagesConfig } from '@/pageKits/events/config'
import type { Committee, EventTag } from '@/prisma-generated-pn-types'

/**
 * Creates a draft from nothing but a name. The rest is filled in on the event's page, and is
 * checked when it is published. The creator's own committee is offered as the host, which then
 * administrates the draft. Without one the draft is the creator's alone until it gets one.
 */
export default function CreateEventForm({ config, eventTags, committees }: {
    /** The event pages to navigate into once created. Under a locked tag the event must carry it. */
    config: EventPagesConfig,
    eventTags: EventTag[],
    /** The committees to choose the host from, or null when they could not be read (they take COMMITTEE_USE). */
    committees: Committee[] | null,
}) {
    const links = eventLinks(config)
    const session = useSession()
    const memberships = session.loading ? [] : session.session.memberships
    const ownCommittee = committees?.find(committee => memberships.some(membership => (
        membership.active && membership.groupId === committee.groupId
    )))
    const [hostId, setHostId] = useState<number | 'NULL'>()
    const host = hostId ?? ownCommittee?.id ?? 'NULL'
    const lockedTag = eventTags.find(tag => config.lockedTag !== null && tag.special === config.lockedTag)

    return <Form
        title="Nytt arrangement"
        className="min-w-[min(80vw,28rem)]"
        action={createEventAction}
        submitText="Opprett utkast"
        navigateOnSuccess={data => (data?.name ? links.event(data) : links.list())}
    >
        <TextInput label="Navn" name="name" />
        {committees && <SelectNumberPossibleNULL
            label="Arrangeres av"
            name="hostedByCommitteeId"
            options={[
                { value: 'NULL', label: 'Ingen komité' },
                ...committees.map(committee => ({ value: committee.id, label: committee.name })),
            ]}
            value={host}
            onChange={setHostId}
        />}
        {lockedTag && <input type="hidden" name="tagIds" value={lockedTag.id} />}
    </Form>
}
