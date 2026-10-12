import styles from './Checkbox.module.scss'
import CheckboxFieldPresent from './CheckboxFieldPresent'
import { useId } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'

type PropTypes = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'name' | 'id'> & {
    label?: string,
    children?: ReactNode
    name: string
    id?: string
}

/**
 * If no value is given, i.e. it is just one on/off checkbox. The SelectAsCheckbox component is used
 * so that the checkbox submits 'off' and not undefined when not checked.
 * @param label - The label shown to user (optional)
 * @param children - If given, the children will be clickable as part of checkbox
 * @returns
 */
function Checkbox({ label, children, id, ...props }: PropTypes) {
    const domId = useId()
    const inputId = id ?? domId

    return (
        <div className={styles.Checkbox}>
            {
                children ? (
                    <label className={styles.inputAndChildren}>
                        <input id={inputId} {...props} type="checkbox" className={styles.input} />
                        {children}
                        {label ? label : <></>}
                    </label>
                ) : (
                    <>
                        <input id={inputId} {...props} type="checkbox" className={styles.input} />
                        {label && <label htmlFor={inputId}>{ label }</label>}
                    </>
                )
            }
            <CheckboxFieldPresent name={props.name} />
        </div>
    )
}

export default Checkbox
