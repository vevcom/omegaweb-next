'use client'
import { defineKind } from './kind'
import TextInput from '@/components/UI/TextInput'

export const stringKind = defineKind<string, { className?: string }>('', ({ label, field, className }) => (
    <TextInput
        name={field.name}
        label={label}
        className={className}
        value={typeof field.value === 'string' ? field.value : ''}
        onChange={event => field.set(event.target.value)}
        onBlur={field.leave}
    />
))
