'use client'
import { defineKind } from './kind'
import DateInput from '@/components/UI/DateInput'
import { dateOfInputValue } from '@/lib/dates/dateInputValue'

// The input keeps what is typed in it, and is given the form's date only when it is first rendered.
export const dateKind = defineKind<{ writes: Date, props: { includeTime?: boolean } }>(
    undefined,
    ({ label, field, includeTime }) => (
        <DateInput
            label={label}
            includeTime={includeTime}
            defaultValue={field.value instanceof Date ? field.value : undefined}
            onChange={event => field.set(dateOfInputValue(event.target.value))}
            onBlur={field.leave}
        />
    ),
)
