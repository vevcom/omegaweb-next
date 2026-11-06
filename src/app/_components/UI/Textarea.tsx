import { useId } from 'react'
import type { TextareaHTMLAttributes } from 'react'

type PropTypes = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'name'> & {
    name: string,
    label?: string,
    background?: 'base' | 'raised',
}

const backgroundClassNames = {
    base: `
        bg-base-200
        hover:bg-base-300
        focus:bg-base-300
    `,
    raised: `
        bg-base-300
        hover:bg-[color-mix(in_srgb,var(--color-base-300),white_10%)]
        focus:bg-[color-mix(in_srgb,var(--color-base-300),white_10%)]
    `,
} as const

export default function Textarea({ label, background = 'base', className, id, ...props }: PropTypes) {
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
                    min-h-[60px] w-full max-h-[60vh] resize-y field-sizing-content text-m text-base-content border-2
                    border-transparent rounded-inner py-3 px-4 transition-[border-color,background-color] duration-300
                    focus:outline-0 focus:border-primary
                    ${backgroundClassNames[background]}
                `}
            ></textarea>
        </div>
    )
}
