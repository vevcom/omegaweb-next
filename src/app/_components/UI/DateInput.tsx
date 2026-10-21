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
                    flex flex-col gap-2 mt-2 w-full max-w-[320px]
                    ${colorClassNames[color]}
                    ${className}
                `
            }
        >
            <label htmlFor={inputId} className="text-s text-text-muted">{label}</label>
            <input
                onChange={setUtc}
                defaultValue={defaultValueTransformedLocal}
                type={includeTime ? 'datetime-local' : 'date'}
                className={`
                    scheme-dark w-full border-2 border-transparent rounded-inner h-14 p-4
                    leading-[calc(var(--text-m)*1.25)] text-m text-ink-strong transition-[border-color,background-color]
                    duration-300
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
