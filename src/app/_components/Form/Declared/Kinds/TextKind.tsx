'use client'
import { defineKind } from './kind'
import Textarea from '@/components/UI/Textarea'

export const textKind = defineKind<{ writes: string, props: { className?: string, placeholder?: string } }>(
    '',
    ({ label, field, className, placeholder }) => (
        <Textarea
            name={field.name}
            label={label}
            className={className}
            placeholder={placeholder}
            value={typeof field.value === 'string' ? field.value : ''}
            onChange={event => field.set(event.target.value)}
            onBlur={field.leave}
        />
    ),
)
