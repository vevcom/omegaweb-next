import { Form } from '@/components/Form/Declared/Form'
import { Require } from '@/auth/authorizer/Require'
import { makeAction } from '@/services/serverAction'
import { defineCapabilities, defineContract } from '@/services/serviceContract'
import { defineOperation } from '@/services/serviceOperation'
import { z } from 'zod'

// Checked by `npx tsc --noEmit` and never run, so jest does not match its name. The
// `@ts-expect-error` lines are the test: tsc fails on any of them that stops being an error.

const contract = defineContract({
    saveNote: {
        data: z.object({
            title: z.string(),
            note: z.string().optional(),
            nickname: z.string().nullable(),
            count: z.number(),
            type: z.enum(['OPEN', 'CLOSED']),
        }),
        authorizer: Require.nothing(),
    },
    saveCount: {
        data: z.object({ count: z.number(), unit: z.string() }),
        authorizer: Require.nothing(),
    },
    destroyNote: {
        params: z.object({ id: z.number() }),
        authorizer: Require.nothing(),
    },
    saveEvent: {
        data: z.object({
            name: z.string(),
            start: z.date(),
            end: z.date().nullable(),
            deadline: z.date().optional(),
            published: z.boolean(),
            hostId: z.number().int().nullable(),
            seats: z.number(),
            type: z.enum(['OPEN', 'CLOSED']),
        }),
        authorizer: Require.nothing(),
    },
})

const capabilities = defineCapabilities(contract, {
    saveNote: makeAction(defineOperation(contract.saveNote, { operation: ({ data }) => data.title })),
    saveCount: makeAction(defineOperation(contract.saveCount, { operation: ({ data }) => data.count })),
    destroyNote: makeAction(defineOperation(contract.destroyNote, { operation: ({ params }) => params.id })),
    saveEvent: makeAction(defineOperation(contract.saveEvent, { operation: ({ data }) => data.name })),
})

export const [NoteSubmitter, NoteField] = Form.Submitter({ capability: capabilities.saveNote })
export const [CountSubmitter, CountField] = Form.Submitter({ capability: capabilities.saveCount })
export const [DestroyNoteSubmitter] = Form.Submitter({ capability: capabilities.destroyNote })
export const [EventSubmitter, EventField] = Form.Submitter({ capability: capabilities.saveEvent })

export const taken = <NoteSubmitter
    submitText="Lagre"
    submitColor="neutral"
    confirmation={{ confirm: true, text: 'Sikker?' }}
    defaultValues={{ title: 'Tittel', nickname: null, count: 2 }}
>
    <NoteField kind="string" name="title" label="Tittel" className="w-full" />
    <NoteField kind="text" name="title" label="Tittel" placeholder="Tittel" />
    {/* A key that may be left out and a key that may be null take a string, so a string field fits them. */}
    <NoteField kind="string" name="note" label="Notat" />
    <NoteField kind="text" name="nickname" label="Kallenavn" />
    <NoteField kind="number" name="count" label="Antall" />
    <CountField kind="string" name="unit" label="Enhet" />
</NoteSubmitter>

export const takenByTheKindsOfValues = <EventSubmitter defaultValues={{ start: new Date(), hostId: null }}>
    <EventField kind="date" name="start" label="Start" includeTime />
    {/* A date that may be none takes a date. */}
    <EventField kind="date" name="end" label="Slutt" />
    <EventField kind="boolean" name="published" label="Publisert" />
    <EventField
        kind="select"
        name="hostId"
        label="Vert"
        options={[{ value: null, label: 'Ingen' }, { value: 3, label: 'Vevcom' }]}
    />
    <EventField kind="select" name="type" label="Type" options={[{ value: 'OPEN', label: 'Åpen' }]} />
    <EventField kind="select" name="name" label="Navn" options={[{ value: 'Bedpres', label: 'Bedpres' }]} />
</EventSubmitter>

// A form with no fields.
export const takenWithoutFields = <DestroyNoteSubmitter params={{ id: 1 }} submitText="Slett" submitColor="error" />

export const refused = <>
    {/* @ts-expect-error A misspelt name. */}
    <NoteField kind="string" name="titel" label="Tittel" />
    {/* @ts-expect-error A name of the wrong kind: the schema takes a number there, and the field writes a string. */}
    <NoteField kind="string" name="count" label="Antall" />
    {/* @ts-expect-error A name of the wrong kind: the schema takes two words there, and not any string. */}
    <NoteField kind="text" name="type" label="Type" />
    {/* @ts-expect-error A prop of another kind: a string field has no placeholder. */}
    <NoteField kind="string" name="title" label="Tittel" placeholder="Tittel" />
    {/* @ts-expect-error A name of the wrong kind: the schema takes a string there, and the field writes a number. */}
    <NoteField kind="number" name="title" label="Tittel" />
    {/* @ts-expect-error A kind the table lacks. */}
    <NoteField kind="color" name="title" label="Tittel" />
    {/* @ts-expect-error The name of another form's schema. */}
    <CountField kind="string" name="title" label="Tittel" />
    {/* @ts-expect-error A default value of the wrong type: the schema takes a number there. */}
    <NoteSubmitter defaultValues={{ count: '2' }} />
    {/* @ts-expect-error A default value under a name the schema lacks. */}
    <NoteSubmitter defaultValues={{ titel: 'Tittel' }} />
    {/* @ts-expect-error A default value for a form whose capability takes no data. */}
    <DestroyNoteSubmitter params={{ id: 1 }} defaultValues={{}} />
    {/* @ts-expect-error A color the submit button lacks. */}
    <NoteSubmitter submitColor="red" />
</>

export const refusedByTheKindsOfValues = <>
    {/* @ts-expect-error A date field on a key that takes a string. */}
    <EventField kind="date" name="name" label="Navn" />
    {/* @ts-expect-error A string field on a key that takes a date. */}
    <EventField kind="string" name="start" label="Start" />
    {/* @ts-expect-error A boolean field on a key that takes a string. */}
    <EventField kind="boolean" name="name" label="Navn" />
    {/* @ts-expect-error A number field on a key that takes a boolean. */}
    <EventField kind="number" name="published" label="Publisert" />
    {/* @ts-expect-error A select on a key that takes a boolean, which is no word, number or none. */}
    <EventField kind="select" name="published" label="Publisert" options={[]} />
    {/* @ts-expect-error A select on a key that takes a date: no option can hold one. */}
    <EventField kind="select" name="start" label="Start" options={[{ value: new Date(), label: 'Nå' }]} />
    {/* @ts-expect-error A select on a key that takes a date, also with no option. */}
    <EventField kind="select" name="start" label="Start" options={[]} />
    {/* @ts-expect-error A select on a key that may be left out and otherwise takes a date. */}
    <EventField kind="select" name="deadline" label="Frist" options={[]} />
    {/* @ts-expect-error An option the key does not take: the schema takes two words there. */}
    <EventField kind="select" name="type" label="Type" options={[{ value: 'DRAFT', label: 'Utkast' }]} />
    {/* @ts-expect-error An option of none for a key that takes a number and not none. */}
    <EventField kind="select" name="seats" label="Plasser" options={[{ value: null, label: 'Ingen' }]} />
    {/* @ts-expect-error A word for a key that takes a number. */}
    <EventField kind="select" name="hostId" label="Vert" options={[{ value: '3', label: 'Vevcom' }]} />
    {/* @ts-expect-error A select with no options. */}
    <EventField kind="select" name="hostId" label="Vert" />
    {/* @ts-expect-error A prop of another kind: a boolean field has no time. */}
    <EventField kind="boolean" name="published" label="Publisert" includeTime />
    {/* @ts-expect-error A default value of the wrong type: the schema takes a date there. */}
    <EventSubmitter defaultValues={{ start: '2026-03-01' }} />
</>
