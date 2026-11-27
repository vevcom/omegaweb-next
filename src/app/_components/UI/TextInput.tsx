import { fieldBackgroundClassNames, fieldColorClassNames, fieldWrapperClassName } from './fieldClassNames'
import { useId } from 'react'
import type { FieldBackground, FieldColor } from './fieldClassNames'
import type { InputHTMLAttributes } from 'react'

export type PropTypes = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'name'> & {
    /** Left out for an input that is part of a larger field, which posts the value itself. */
    name?: string,
    label: string,
    type?: 'text' | 'password' | 'number',
    color?: FieldColor,
    background?: FieldBackground,
    /** 40px tall instead of 56px, to sit in a row of header pills. */
    compact?: boolean,
}

export default function TextInput({
    label = 'default',
    type = 'text',
    color = 'base',
    background = 'base200',
    compact = false,
    className,
    id,
    ...props
}: PropTypes) {
    const domId = useId()
    const inputId = id ?? domId

    return (
        <div className={`
            ${fieldWrapperClassName}
            flex flex-col
            ${className}
        `}>
            <input
                {...props}
                id={inputId}
                type={type}
                className={`
                    peer w-full rounded-inner outline-0 text-m leading-[calc(var(--text-m)*1.25)] px-4
                    transition-[border-color,background-color,box-shadow] duration-300 z-1
                    placeholder:opacity-0
                    [appearance:textfield]
                    [&::-webkit-inner-spin-button]:appearance-none
                    [&::-webkit-outer-spin-button]:appearance-none
                    ${compact
            ? 'border-2 border-transparent pt-3.5 pb-0.5'
            : `
                border border-base-300
                focus:ring-3 focus:ring-primary/25
                pt-6 pb-2.5
            `}
                    ${fieldColorClassNames[color].field}
                    ${fieldBackgroundClassNames[background]}
                `}
                placeholder={label}
            />
            <label htmlFor={inputId} className={`
                absolute left-4 block text-base-content/80 transition-all duration-300 pointer-events-none z-2
                peer-placeholder-shown:text-m peer-placeholder-shown:cursor-text
                ${compact ? `
                    top-0.5 text-[length:calc(var(--text-s)*0.7)]
                    peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2
                    peer-focus:top-0.5 peer-focus:translate-y-0 peer-focus:text-[length:calc(var(--text-s)*0.7)]
                ` : `
                    top-2 text-[length:calc(var(--text-s)*0.85)]
                    peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2
                    peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-[length:calc(var(--text-s)*0.85)]
                `}
                ${fieldColorClassNames[color].label}
            `}>{label}</label>
        </div>
    )
}
