import styles from './NumberInput.module.scss'
import { useId } from 'react'
import type { InputHTMLAttributes } from 'react'

export type PropTypes = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'name'> & {
    name: string,
    label: string,
    color?: 'primary' | 'secondary' | 'red' | 'black' | 'white',
    background?: 'base' | 'raised',
}

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
        <div
            className={
                `${styles.NumberInput} ${styles[color]} `
                + `${background === 'raised' ? styles.onRaised : ''} ${className}`
            }
        >
            <input {...props} id={inputId} type="number" className={styles.field} placeholder={label}/>
            <label htmlFor={inputId} className={styles.labe}>{label}</label>
        </div>
    )
}
