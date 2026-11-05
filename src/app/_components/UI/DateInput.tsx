'use client'
import { displayDefaultInputValue } from '@/lib/dates/displayDefaultInputValue'
import { useId, useState } from 'react'
import type { PropTypes as PropTypesInput } from './TextInput'
import type { ChangeEvent } from 'react'

type PropTypes = Omit<PropTypesInput, 'type' | 'defaultValue'> & {
    defaultValue?: PropTypesInput['defaultValue'] | Date,
    includeTime?: boolean,
}

const colorClassNames = {
    white: 'text-text-inv',
    primary: 'text-accent-blue',
    secondary: 'text-surface-base',
    red: 'text-accent-red',
    black: 'text-text',
} as const

const backgroundClassNames = {
    base: `
        bg-surface-raised
        hover:bg-surface-hover
        focus:bg-surface-hover
    `,
    raised: `
        bg-surface-hover
        hover:bg-[color-mix(in_srgb,var(--surface-hover),white_10%)]
        focus:bg-[color-mix(in_srgb,var(--surface-hover),white_10%)]
    `,
} as const

export default function DateInput({
    label = 'default',
    color = 'black',
    background = 'base',
    className,
    defaultValue,
    includeTime = false,
    id,
    ...props
}: Omit<PropTypes, 'type'>) {
    const domId = useId()
    const inputId = id ?? domId
    const defaultValueTransformedLocal = defaultValue instanceof Date
        ? displayDefaultInputValue(defaultValue, includeTime)
        : defaultValue
    const defaultValueTransformedUtc = defaultValue instanceof Date
        ? defaultValue.toISOString().substring(0, includeTime ? 16 : 10)
        : defaultValue
    const [utcValue, setUtcValue] = useState(defaultValueTransformedUtc)

    const setUtc = (e: ChangeEvent<HTMLInputElement>) => {
        setUtcValue(new Date(e.target.value).toISOString().substring(0, includeTime ? 16 : 10))
    }

    return (
        <div
            className={
                `
                    relative mt-2 w-full max-w-[320px]
                    ${colorClassNames[color]}
                    ${className}
                `
            }
        >
            <input
                onChange={setUtc}
                defaultValue={defaultValueTransformedLocal}
                type={includeTime ? 'datetime-local' : 'date'}
                className={`
                    scheme-dark w-full border border-surface-subtle
                    focus:ring-3 focus:ring-accent-blue/25
                    rounded-inner h-14 pt-6 pb-1 px-4 leading-[calc(var(--text-m)*1.25)] text-m text-ink-strong
                    transition-[border-color,background-color,box-shadow] duration-300
                    focus:outline-0 focus:border-accent-blue
                    [&::-webkit-calendar-picker-indicator]:cursor-pointer
                    [&::-webkit-calendar-picker-indicator]:rounded-[calc(var(--gap)/2)]
                    [&::-webkit-calendar-picker-indicator]:transition-colors
                    [&::-webkit-calendar-picker-indicator]:duration-300
                    [&::-webkit-calendar-picker-indicator]:hover:bg-surface-subtle
                    ${backgroundClassNames[background]}
                `}
                {...props}
                id={inputId}
                name={`${props.name}Local`}
            />
            <label htmlFor={inputId} className="
                absolute left-4 top-2 text-[length:calc(var(--text-s)*0.85)] text-text-muted pointer-events-none
            ">{label}</label>
            <input
                defaultValue={defaultValueTransformedUtc}
                {...props}
                type="hidden"
                name={props.name}
                value={utcValue}
            />
        </div>
    )
}
