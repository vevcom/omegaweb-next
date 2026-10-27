import { useId } from 'react'
import type { InputHTMLAttributes } from 'react'


export type PropTypes = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'name'> & {
    name: string,
    label: string,
    type?: 'text' | 'password',
    color?: 'primary' | 'secondary' | 'red' | 'black' | 'white',
    background?: 'base' | 'raised',
    /** 40px tall instead of 56px, to sit in a row of header pills. */
    compact?: boolean,
}

const colorClassNames = {
    black: { field: `
        text-ink-strong
        focus:border-accent-blue
    `, label: 'peer-focus:text-accent-blue' },
    primary: { field: `
        text-accent-blue
        focus:border-accent-blue
    `, label: 'peer-focus:text-accent-blue' },
    secondary: { field: `
        text-surface-base
        focus:border-surface-base
    `, label: 'peer-focus:text-surface-base' },
    red: { field: `
        text-accent-red
        focus:border-accent-red
    `, label: 'peer-focus:text-accent-red' },
    white: { field: `
        text-white
        focus:border-accent-blue
    `, label: 'peer-focus:text-accent-blue' },
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

export default function TextInput({
    label = 'default',
    type = 'text',
    color = 'black',
    background = 'base',
    compact = false,
    className,
    id,
    ...props
}: PropTypes) {
    const domId = useId()
    const inputId = id ?? domId

    return (
        <div className={`
            relative mt-2 w-full max-w-[320px] flex flex-col
            ${className}
        `}>
            <input
                {...props}
                id={inputId}
                type={type}
                className={`
                    peer w-full border-2 border-transparent rounded-inner outline-0 text-m
                    leading-[calc(var(--text-m)*1.25)] px-4 transition-[border-color,background-color] duration-300 z-1
                    placeholder:opacity-0
                    ${compact ? 'pt-3.5 pb-0.5' : 'pt-6 pb-2'}
                    ${colorClassNames[color].field}
                    ${backgroundClassNames[background]}
                `}
                placeholder={label}
            />
            <label htmlFor={inputId} className={`
                absolute left-4 block text-text-muted transition-all duration-300 pointer-events-none z-2
                peer-placeholder-shown:text-m peer-placeholder-shown:cursor-text
                ${compact ? `
                    top-0.5 text-[length:calc(var(--text-s)*0.7)]
                    peer-placeholder-shown:top-2.5
                    peer-focus:top-0.5 peer-focus:text-[length:calc(var(--text-s)*0.7)]
                ` : `
                    top-2 text-[length:calc(var(--text-s)*0.85)]
                    peer-placeholder-shown:top-6
                    peer-focus:top-2 peer-focus:text-[length:calc(var(--text-s)*0.85)]
                `}
                ${colorClassNames[color].label}
            `}>{label}</label>
        </div>
    )
}
