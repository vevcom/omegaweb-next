import { fieldBackgroundClassNames } from './fieldClassNames'
import { useId } from 'react'
import type { FieldBackground } from './fieldClassNames'
import type { TextareaHTMLAttributes } from 'react'

type PropTypes = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'name'> & {
    name: string,
    label?: string,
    background?: FieldBackground,
}

export default function Textarea({ label, background = 'base200', className, id, ...props }: PropTypes) {
    const domId = useId()
    const inputId = id ?? domId

    return (
        <div className={`
            flex flex-col gap-1 mt-2 w-full
            ${className ?? ''}
        `}>
            <label htmlFor={inputId} className="text-s text-base-content/80">{ label }</label>
            <textarea
                {...props}
                id={inputId}
                className={`
                    min-h-[60px] w-full max-h-[60vh] resize-y field-sizing-content text-m text-base-content border
                    border-base-300
                    focus:ring-3 focus:ring-primary/25
                    rounded-inner py-3 px-4 transition-[border-color,background-color,box-shadow] duration-300
                    focus:outline-0 focus:border-primary
                    ${fieldBackgroundClassNames[background]}
                `}
            ></textarea>
        </div>
    )
}
