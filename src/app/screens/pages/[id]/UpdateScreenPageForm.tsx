'use client'
import { updateScreenPageAction } from '@/services/screens/pages/actions'
import { screenPageTypeLabels } from '@/services/screens/pages/constants'
import { configureAction } from '@/services/configureAction'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import { SelectConstructor, SelectNumber } from '@/components/UI/Select'
import { ScreenPageType } from '@/prisma-generated-pn-types'
import { useState } from 'react'
import { z } from 'zod'
import type { ScreenPage } from '@/prisma-generated-pn-types'

type LinkOption = { value: number, label: string }

const SelectScreenPageType = SelectConstructor(value => z.nativeEnum(ScreenPageType).parse(value))

/**
 * Sets the name and type of a page, and what it links to. Only the choice the chosen type needs is
 * shown, and only that one is submitted.
 */
export default function UpdateScreenPageForm({ screenPage, jobAds, events, eventTags }: {
    screenPage: Pick<ScreenPage, 'id' | 'name' | 'type' | 'jobAdId' | 'eventId' | 'eventTagId'>,
    jobAds: LinkOption[],
    events: LinkOption[],
    eventTags: LinkOption[],
}) {
    const [type, setType] = useState(screenPage.type)

    return <Form
        title="Side"
        action={configureAction(updateScreenPageAction, { params: { id: screenPage.id } })}
        submitText="Lagre"
        refreshOnSuccess
        closePopUpOnSuccess="screenPageSettings"
    >
        <TextInput name="name" label="Navn" defaultValue={screenPage.name} />
        <SelectScreenPageType
            name="type"
            label="Type"
            value={type}
            onChange={setType}
            options={Object.values(ScreenPageType).map(pageType => ({
                value: pageType,
                label: screenPageTypeLabels[pageType],
            }))}
        />
        {type === 'JOBAD' && <LinkSelect
            name="jobAdId"
            label="Stillingsannonse"
            empty="Det er ingen aktive stillingsannonser å vise."
            defaultValue={screenPage.jobAdId}
            options={jobAds}
        />}
        {type === 'EVENT' && <LinkSelect
            name="eventId"
            label="Arrangement"
            empty="Det er ingen kommende arrangementer å vise."
            defaultValue={screenPage.eventId}
            options={events}
        />}
        {type === 'EVENT_TAG' && <LinkSelect
            name="eventTagId"
            label="Tagg"
            empty="Det er ingen tagger å velge."
            defaultValue={screenPage.eventTagId}
            options={eventTags}
        />}
    </Form>
}

function LinkSelect({ name, label, empty, defaultValue, options }: {
    name: string,
    label: string,
    empty: string,
    defaultValue: number | null,
    options: LinkOption[],
}) {
    if (options.length === 0) return <p>{empty}</p>
    return <SelectNumber name={name} label={label} defaultValue={defaultValue ?? undefined} options={options} />
}
