import { useId } from 'react'
import type { InputHTMLAttributes } from 'react'

export type PropTypes = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'name'> & {
    name: string,
    label: string,
    color?: 'primary' | 'secondary' | 'red' | 'black' | 'white',
    background?: 'base' | 'raised',
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
        text-text
        focus:border-accent-blue
    `, label: 'peer-focus:text-accent-blue' },
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

export default function NumberInput({
    label,
    color = 'black',
    background = 'base',
    className,
    id,
    ...props
}: PropTypes) {
    const domId = useId()
    const inputId = id ?? domId

    return (
        <div className={`
            relative mt-2 w-full max-w-[200px] flex flex-col
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
                absolute left-4 top-2 block text-[length:calc(var(--text-s)*0.85)] text-text-muted transition-all
                duration-300 pointer-events-none z-2
                peer-placeholder-shown:top-6 peer-placeholder-shown:text-m peer-placeholder-shown:cursor-text
                peer-focus:top-2 peer-focus:text-[length:calc(var(--text-s)*0.85)]
                ${colorClassNames[color].label}
            `}>{label}</label>
        </div>
    )
}
