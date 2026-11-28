'use client'
import { defineKind } from './kind'
import dynamic from 'next/dynamic'

// The editor is heavy, and every form has every kind, so it is loaded when a rich text field is first rendered.
const RichTextInput = dynamic(() => import('@/components/UI/RichTextInput'))

// The editor's ring is drawn outside it, so the margin keeps the field's error as clear of the ring as other errors
// are of their input.
export const richTextKind = defineKind<{ writes: string, props: { defaultHtml?: string } }>(
    '',
    ({ label, field, defaultHtml }) => (
        <div className="mb-2">
            <RichTextInput
                label={label}
                defaultValue={typeof field.value === 'string' ? field.value : ''}
                defaultHtml={defaultHtml}
                onChange={field.setReader}
                onBlur={field.leave}
            />
        </div>
    ),
)
