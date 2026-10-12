'use client'
import styles from './FileInput.module.scss'
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

    return (
        <div
            className={
                `${styles.FileInput} ${styles[color]} ` +
                `${background === 'raised' ? styles.onRaised : ''} ${className ?? ''}`
            }
        >
            <input
                {...props}
                id={inputId}
                type="file"
                className={styles.field}
                onChange={handleFileChange}
            />
            <label htmlFor={inputId} className={styles.trigger}>
                <span className={styles.value} title={value}>{value}</span>
                <FontAwesomeIcon icon={faPaperclip} className={styles.icon} />
            </label>
            <label htmlFor={inputId} className={`${styles.labe} ${value ? styles.floated : ''}`}>
                {label}
            </label>
        </div>
    )
}
