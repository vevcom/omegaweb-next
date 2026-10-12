import styles from './Textarea.module.scss'
import { useId } from 'react'
import type { TextareaHTMLAttributes } from 'react'

type PropTypes = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'name'> & {
    name: string,
    label?: string,
    background?: 'base' | 'raised',
}

export default function Textarea({ label, background = 'base', className, id, ...props }: PropTypes) {
    const domId = useId()
    const inputId = id ?? domId

    return (
        <div className={`${styles.TextArea} ${background === 'raised' ? styles.onRaised : ''} ${className ?? ''}`}>
            <label htmlFor={inputId}>{ label }</label>
            <textarea {...props} id={inputId}></textarea>
        </div>
    )
}
