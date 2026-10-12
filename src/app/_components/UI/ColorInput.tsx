'use client'
import styles from './ColorInput.module.scss'
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
                `${styles.ColorInput} ${background === 'raised' ? styles.onRaised : ''} ${className ?? ''}`
            }
        >
            <input
                {...props}
                id={inputId}
                type="color"
                className={styles.field}
                onChange={handleChange}
            />
            <label htmlFor={inputId} className={styles.trigger}>
                <span className={styles.swatch} style={{ backgroundColor: color }} />
                <span className={styles.value}>{color.toUpperCase()}</span>
            </label>
            <label htmlFor={inputId} className={styles.labe}>{label}</label>
        </div>
    )
}
