import { useId } from 'react'
import type { InputHTMLAttributes } from 'react'

export type PropTypes = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'name'> & {
    name: string,
    label: string,
    color?: 'primary' | 'secondary' | 'error' | 'base',
    background?: 'base100' | 'base200',
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
    `, label: 'peer-focus:text-secondary' },
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

export default function NumberInput({
    label,
    color = 'base',
    background = 'base100',
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
                type="number"
                className={`
                    peer w-full border-2 border-transparent rounded-inner outline-0 text-m
                    leading-[calc(var(--text-m)*1.25)] pt-6 px-4 pb-2 transition-[border-color,background-color]
                    duration-300 z-1
                    placeholder:opacity-0
                    ${colorClassNames[color].field}
                    ${backgroundClassNames[background]}
                `}
                placeholder={label}
            />
            <label htmlFor={inputId} className={`
                absolute left-4 top-2 block text-[length:calc(var(--text-s)*0.85)] text-base-content/80 transition-all
                duration-300 pointer-events-none z-2
                peer-placeholder-shown:top-6 peer-placeholder-shown:text-m peer-placeholder-shown:cursor-text
                peer-focus:top-2 peer-focus:text-[length:calc(var(--text-s)*0.85)]
                ${colorClassNames[color].label}
            `}>{label}</label>
        </div>
    )
}
