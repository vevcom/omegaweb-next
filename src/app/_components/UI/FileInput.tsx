'use client'
import { fieldPeerBackgroundClassNames, fieldWrapperClassName } from './fieldClassNames'
import { useId, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPaperclip } from '@fortawesome/free-solid-svg-icons'
import type { FieldBackground } from './fieldClassNames'
import type { InputHTMLAttributes, ChangeEvent } from 'react'

export type PropTypes = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'name'> & {
    name: string,
    label: string,
    color?: 'base' | 'primary' | 'error',
    background?: FieldBackground,
}

const valueColorClassNames = {
    base: 'text-base-content',
    primary: 'text-primary',
    error: 'text-error',
} as const

const focusClassNames = {
    primary: {
        trigger: `
            peer-focus:border-primary
            peer-focus:[&_svg]:text-primary
        `,
        label: 'peer-focus:text-primary',
    },
    error: {
        trigger: `
            peer-focus:border-error
            peer-focus:[&_svg]:text-error
        `,
        label: 'peer-focus:text-error',
    },
} as const

/**
 * A file picker styled like the other form fields: the real input is visually
 * hidden but still focusable, and the surface below it doubles as the label that
 * opens the picker. The chosen file name takes the place of the field value, so
 * the floating label behaves exactly as it does in TextInput.
 * @param label - The label shown to the user
 * @param color - Colours the file name, like the other fields
 * @param background - The surface the field is drawn as, see `FieldBackground`
 */
export default function FileInput({
    label,
    color = 'base',
    background = 'base200',
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

    const focus = focusClassNames[color === 'error' ? 'error' : 'primary']

    return (
        <div className={`
            ${fieldWrapperClassName}
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
                    relative w-full flex items-center border border-base-300
                    peer-focus:ring-3 peer-focus:ring-primary/25
                    rounded-inner outline-0 text-m text-left text-base-content pt-6 pr-10 pb-2.5 pl-4
                    transition-[border-color,background-color,box-shadow] duration-300 cursor-pointer
                    peer-disabled:cursor-not-allowed peer-disabled:opacity-60
                    ${fieldPeerBackgroundClassNames[background]}
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
                    className="
                        absolute right-4 top-1/2 -translate-y-1/2 text-base-content/80 transition-colors duration-300
                    "
                />
            </label>
            <label
                htmlFor={inputId}
                className={`
                    absolute left-4 block text-base-content/80 transition-all duration-300 pointer-events-none z-1
                    ${value ? 'top-2 text-[length:calc(var(--text-s)*0.85)]' : 'top-1/2 -translate-y-1/2 text-m'}
                    peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-[length:calc(var(--text-s)*0.85)]
                    ${focus.label}
                `}
            >
                {label}
            </label>
        </div>
    )
}
