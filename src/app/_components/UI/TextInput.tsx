import { useId } from 'react'
import type { InputHTMLAttributes } from 'react'


export type PropTypes = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'name'> & {
    name: string,
    label: string,
    type?: 'text' | 'password',
    color?: 'base' | 'secondary' | 'error',
    background?: 'base100' | 'base200',
    /** 40px tall instead of 56px, to sit in a row of header pills. */
    compact?: boolean,
}

const colorClassNames = {
    base: { field: `
        text-base-content
        focus:border-base-content
    `, label: 'peer-focus:text-base-content' },
    primary: { field: `
        text-primary
        focus:border-primary
    `, label: 'peer-focus:text-primary' },
    secondary: { field: `
        text-secondary
        focus:border-secondary    
    `, label: 'peer-focus:text-secondary'},
    error: { field: `
        text-error
        focus:border-error
    `, label: 'peer-focus:text-error' },
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

export default function TextInput({
    label = 'default',
    type = 'text',
    color = 'base',
    background = 'base100',
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
                ${colorClassNames[color].label}
            `}>{label}</label>
        </div>
    )
}
