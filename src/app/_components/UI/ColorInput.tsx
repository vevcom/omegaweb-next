'use client'
import { useId, useState } from 'react'
import type { InputHTMLAttributes, ChangeEvent } from 'react'

export type PropTypes = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'name'> & {
    name: string,
    defaultValueRGB?: {
        red: number,
        green: number,
        blue: number
    }
    label: string,
    background?: 'base' | 'raised',
}

const backgroundClassNames = {
    base: `
        bg-base-200
        hover:bg-base-300
        peer-focus:bg-base-300
    `,
    raised: `
        bg-base-300
        hover:bg-[color-mix(in_srgb,var(--color-base-300),white_10%)]
        peer-focus:bg-[color-mix(in_srgb,var(--color-base-300),white_10%)]
    `,
} as const

const rgbToHex = (red: number, green: number, blue: number): string => {
    const toHex = (value: number) => {
        const hex = value.toString(16)
        return hex.length === 1 ? `0${hex}` : hex
    }

    return `#${toHex(red)}${toHex(green)}${toHex(blue)}`
}

/**
 * A component for selecting a color. Uses the HTML input type color and native browser color picker,
 * dressed as a form field so it sits alongside the other inputs: the swatch takes the place of the
 * field value, with the selected hex shown next to it.
 * @param label - the label of the input (displayed to user)
 * @param className - the class name of the input
 * @param defaultValueRGB - the default value of the input in RGB format
 * @param background - 'raised' when the field sits on a raised surface
 * @prop name - the name of the input
 * @returns
 */
export default function ColorInput({
    label,
    className,
    defaultValueRGB,
    background = 'base',
    onChange,
    ...props
}: PropTypes) {
    const domId = useId()
    const inputId = props.id ?? domId

    if (defaultValueRGB) {
        const { red, green, blue } = defaultValueRGB
        props.defaultValue = rgbToHex(red, green, blue)
    }

    const [color, setColor] = useState(String(props.value ?? props.defaultValue ?? '#000000'))

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        setColor(event.target.value)
        onChange?.(event)
    }

    return (
        <div
            className={
                `
                    relative w-full max-w-[320px] mt-2
                    ${className ?? ''}
                `
            }
        >
            <input
                {...props}
                id={inputId}
                type="color"
                // Stays focusable and labelled since it opens the OS picker; the trigger label is what is styled.
                className="peer absolute w-px h-px opacity-0 pointer-events-none"
                onChange={handleChange}
            />
            <label htmlFor={inputId} className={`
                relative w-full flex items-center gap-2 border-2 border-transparent rounded-inner outline-0 text-m
                text-left pt-6 px-4 pb-2 transition-[border-color,background-color] duration-300 cursor-pointer
                peer-focus:border-primary
                peer-disabled:cursor-not-allowed peer-disabled:opacity-60
                ${backgroundClassNames[background]}
            `}>
                <span
                    className="
                        shrink-0 size-[calc(var(--text-m)*1.25)] rounded-[calc(var(--rounding)-1.5*var(--gap))]
                        shadow-[inset_0_0_0_1px_var(--color-base-300)]
                    "
                    style={{ backgroundColor: color }} />
                <span className="min-h-[calc(var(--text-m)*1.25)] flex items-center tabular-nums text-base-content">
                    {color.toUpperCase()}
                </span>
            </label>
            <label
                htmlFor={inputId}
                className="
                    absolute left-4 top-2 block text-[length:calc(var(--text-s)*0.85)] text-base-content/80
                    peer-focus:text-primary
                    transition-all duration-300 pointer-events-none z-1
                "
            >
                {label}
            </label>
        </div>
    )
}
