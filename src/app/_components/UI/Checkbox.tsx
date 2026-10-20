import CheckboxFieldPresent from './CheckboxFieldPresent'
import { useId } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'

const inputClassName = 'appearance-none inline-grid place-content-center shrink-0 size-5 mr-2 border-2 border-text-muted rounded-[calc(var(--gap)*0.75)] bg-transparent cursor-pointer transition-[background-color,border-color] duration-300 after:w-[5px] after:h-[9px] after:border-solid after:border-text-inv after:border-t-0 after:border-l-0 after:border-r-2 after:border-b-2 after:[transform:rotate(45deg)_translate(-1px,-1px)] after:opacity-0 after:transition-opacity after:duration-300 hover:border-accent-blue checked:bg-accent-blue checked:border-accent-blue checked:after:opacity-100 focus-visible:outline-2 focus-visible:outline-accent-blue focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50'

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
        <div className="text-m text-ink-strong my-1 mr-1 ml-0 inline-flex items-center [&>label]:cursor-pointer">
            {
                children ? (
                    <label className="flex items-center">
                        <input id={inputId} {...props} type="checkbox" className={inputClassName} />
                        {children}
                        {label ? label : <></>}
                    </label>
                ) : (
                    <>
                        <input id={inputId} {...props} type="checkbox" className={inputClassName} />
                        {label && <label htmlFor={inputId}>{ label }</label>}
                    </>
                )
            }
            <CheckboxFieldPresent name={props.name} />
        </div>
    )
}

export default Checkbox
