'use client'
import { useFormReset, useInputEvent } from '@/components/Form/JsonFieldInput'
import { utcInputValue } from '@/lib/dates/dateInputValue'
import { displayDefaultInputValue } from '@/lib/dates/displayDefaultInputValue'
import { useId, useRef, useState } from 'react'
import type { PropTypes as PropTypesInput } from './TextInput'
import type { ChangeEvent } from 'react'

type PropTypes = Omit<PropTypesInput, 'type' | 'defaultValue'> & {
    defaultValue?: PropTypesInput['defaultValue'] | Date,
    includeTime?: boolean,
}

const colorClassNames = {
    base: 'text-base-content',
    primary: 'text-primary',
    secondary: 'text-secondary',
    error: 'text-error',
} as const

const backgroundClassNames = {
    base100: `
        bg-base-100
        hover:bg-base-200
        focus:bg-base-200
    `,
    base200: `
        bg-base-200
        hover:bg-base-300
        focus:bg-base-300
    `,
} as const

/**
 * A date, with the time when `includeTime` is set. It is picked in the browser's own zone and
 * posted under `name` in UTC, see `utcInputValue`. Without a name it posts nothing, for an input
 * that is part of a larger field.
 */
export default function DateInput({
    label = 'default',
    color = 'base',
    background = 'base200',
    className,
    defaultValue,
    includeTime = false,
    id,
    name,
    ...props
}: Omit<PropTypes, 'type'>) {
    const domId = useId()
    const inputId = id ?? domId
    const defaultValueTransformedLocal = defaultValue instanceof Date
        ? displayDefaultInputValue(defaultValue, includeTime)
        : defaultValue
    const defaultValueTransformedUtc = defaultValue instanceof Date
        ? utcInputValue(defaultValue, includeTime)
        : defaultValue
    const [utcValue, setUtcValue] = useState(defaultValueTransformedUtc)
    const utcInputRef = useRef<HTMLInputElement>(null)
    useInputEvent(utcInputRef, String(utcValue ?? ''))
    // The browser resets the date that is picked, and the one posted follows here.
    useFormReset(utcInputRef, () => setUtcValue(defaultValueTransformedUtc))

    const setUtc = (e: ChangeEvent<HTMLInputElement>) => {
        setUtcValue(utcInputValue(new Date(e.target.value), includeTime))
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
                    scheme-dark w-full border border-base-300
                    focus:ring-3 focus:ring-primary/25
                    rounded-inner h-14 pt-6 pb-1 px-4 leading-[calc(var(--text-m)*1.25)] text-m text-base-content
                    transition-[border-color,background-color,box-shadow] duration-300
                    focus:outline-0 focus:border-primary
                    [&::-webkit-calendar-picker-indicator]:cursor-pointer
                    [&::-webkit-calendar-picker-indicator]:rounded-[calc(var(--gap)/2)]
                    [&::-webkit-calendar-picker-indicator]:transition-colors
                    [&::-webkit-calendar-picker-indicator]:duration-300
                    [&::-webkit-calendar-picker-indicator]:hover:bg-base-300
                    ${backgroundClassNames[background]}
                `}
                {...props}
                id={inputId}
                name={name && `${name}Local`}
            />
            <label htmlFor={inputId} className="
                absolute left-4 top-2 text-[length:calc(var(--text-s)*0.85)] text-base-content/80 pointer-events-none
            ">{label}</label>
            {name && <input
                {...props}
                ref={utcInputRef}
                type="hidden"
                name={name}
                value={utcValue}
            />}
        </div>
    )
}
