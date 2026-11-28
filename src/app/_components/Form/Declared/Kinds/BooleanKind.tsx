'use client'
import { defineKind } from './kind'
import Checkbox from '@/components/UI/Checkbox'

export const booleanKind = defineKind<{ writes: boolean, props: Record<never, never> }>(
    false,
    ({ label, field }) => (
        <Checkbox
            label={label}
            checked={field.value === true}
            onChange={event => field.set(event.target.checked)}
            onBlur={field.leave}
        />
    ),
)
