'use client'
import { useId, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPaperclip } from '@fortawesome/free-solid-svg-icons'
import type { InputHTMLAttributes, ChangeEvent } from 'react'

export type PropTypes = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'name'> & {
    name: string,
    label: string,
    color?: 'primary' | 'secondary' | 'red' | 'black' | 'white',
    background?: 'base' | 'raised',
}

const valueColorClassNames = {
    black: 'text-ink-strong',
    primary: 'text-accent-blue',
    secondary: 'text-text',
    red: 'text-accent-red',
    white: 'text-white',
} as const

const focusClassNames = {
    blue: {
        trigger: `
            peer-focus:border-accent-blue
            peer-focus:[&_svg]:text-accent-blue
        `,
        label: 'peer-focus:text-accent-blue',
    },
    red: {
        trigger: `
            peer-focus:border-accent-red
            peer-focus:[&_svg]:text-accent-red
        `,
        label: 'peer-focus:text-accent-red',
    },
} as const

const backgroundClassNames = {
    base: `
        bg-surface-raised
        hover:bg-surface-hover
        peer-focus:bg-surface-hover
    `,
    raised: `
        bg-surface-hover
        hover:bg-[color-mix(in_srgb,var(--surface-hover),white_10%)]
        peer-focus:bg-[color-mix(in_srgb,var(--surface-hover),white_10%)]
    `,
} as const

/**
 * A file picker styled like the other form fields: the real input is visually
 * hidden but still focusable, and the surface below it doubles as the label that
 * opens the picker. The chosen file name takes the place of the field value, so
 * the floating label behaves exactly as it does in TextInput.
 * @param label - The label shown to the user
 * @param color - Colours the file name, like the other fields
 * @param background - 'raised' when the field sits on a raised surface
 */
export default function FileInput({
    label,
    color = 'black',
    background = 'base',
    className,
    onChange,
    ...props
}: PropTypes) {
    const domId = useId()
    const inputId = props.id ?? domId
    const [fileNames, setFileNames] = useState<string[]>([])

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        setFileNames(Array.from(event.target.files ?? []).map(file => file.name))
        onChange?.(event)
    }

    const value = fileNames.length > 1
        ? `${fileNames.length} filer valgt`
        : fileNames[0] ?? ''

    const focus = focusClassNames[color === 'red' ? 'red' : 'blue']

    return (
        <div className={`
            relative w-full max-w-[320px]
            in-[[role=dialog]]:max-w-none
            mt-2
            ${className ?? ''}
        `}>
            <input
                {...props}
                id={inputId}
                type="file"
                // Stays in the layout so it can hold focus and be labelled; the trigger is what the user sees.
                className="peer absolute w-px h-px opacity-0 pointer-events-none"
                onChange={handleFileChange}
            />
            <label
                htmlFor={inputId}
                className={`
                    relative w-full flex items-center border-2 border-transparent rounded-inner outline-0 text-m text-left
                    text-ink-strong pt-6 pr-10 pb-2 pl-4 transition-[border-color,background-color] duration-300
                    cursor-pointer
                    peer-disabled:cursor-not-allowed peer-disabled:opacity-60
                    ${backgroundClassNames[background]}
                    ${focus.trigger}
                `}
            >
                <span
                    className={`
                        overflow-hidden text-ellipsis whitespace-nowrap min-h-[calc(var(--text-m)*1.25)]
                        ${valueColorClassNames[color]}
                    `}
                    title={value}
                >
                    {value}
                </span>
                <FontAwesomeIcon
                    icon={faPaperclip}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted transition-colors duration-300"
                />
            </label>
            <label
                htmlFor={inputId}
                className={`
                    absolute left-4 block text-text-muted transition-all duration-300 pointer-events-none z-1
                    ${value ? 'top-2 text-[length:calc(var(--text-s)*0.85)]' : 'top-6 text-m'}
                    peer-focus:top-2 peer-focus:text-[length:calc(var(--text-s)*0.85)]
                    ${focus.label}
                `}
            >
                {label}
            </label>
        </div>
    )
}
