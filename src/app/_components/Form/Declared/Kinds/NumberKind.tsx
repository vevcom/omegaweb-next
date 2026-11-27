'use client'
import { defineKind } from './kind'
import NumberInput from '@/components/UI/NumberInput'

export const numberKind = defineKind<number, { className?: string }>(undefined, ({ label, field, className }) => (
    <NumberInput
        name={field.name}
        label={label}
        className={className}
        value={typeof field.value === 'number' ? field.value : ''}
        onChange={event => field.set(Number.isNaN(event.target.valueAsNumber) ? undefined : event.target.valueAsNumber)}
        onBlur={field.leave}
    />
))
