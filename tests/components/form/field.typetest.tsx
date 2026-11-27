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
})

const capabilities = defineCapabilities(contract, {
    saveNote: makeAction(defineOperation(contract.saveNote, { operation: ({ data }) => data.title })),
    saveCount: makeAction(defineOperation(contract.saveCount, { operation: ({ data }) => data.count })),
})

export const [NoteSubmitter, NoteField] = Form.Submitter({ capability: capabilities.saveNote })
export const [CountSubmitter, CountField] = Form.Submitter({ capability: capabilities.saveCount })

export const taken = <NoteSubmitter submitText="Lagre">
    <NoteField kind="string" name="title" label="Tittel" className="w-full" />
    <NoteField kind="text" name="title" label="Tittel" placeholder="Tittel" />
    {/* A key that may be left out and a key that may be null take a string, so a string field fits them. */}
    <NoteField kind="string" name="note" label="Notat" />
    <NoteField kind="text" name="nickname" label="Kallenavn" />
    <CountField kind="string" name="unit" label="Enhet" />
</NoteSubmitter>

export const refused = <>
    {/* @ts-expect-error A misspelt name. */}
    <NoteField kind="string" name="titel" label="Tittel" />
    {/* @ts-expect-error A name of the wrong kind: the schema takes a number there, and the field writes a string. */}
    <NoteField kind="string" name="count" label="Antall" />
    {/* @ts-expect-error A name of the wrong kind: the schema takes two words there, and not any string. */}
    <NoteField kind="text" name="type" label="Type" />
    {/* @ts-expect-error A prop of another kind: a string field has no placeholder. */}
    <NoteField kind="string" name="title" label="Tittel" placeholder="Tittel" />
    {/* @ts-expect-error A kind the table lacks. */}
    <NoteField kind="number" name="title" label="Tittel" />
    {/* @ts-expect-error The name of another form's schema. */}
    <CountField kind="string" name="title" label="Tittel" />
</>
