import { useId } from 'react'
import type { TextareaHTMLAttributes } from 'react'

type PropTypes = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'name'> & {
    name: string,
    label?: string,
    background?: 'base' | 'raised',
}

const backgroundClassNames = {
    base: `
        bg-surface-raised
        hover:bg-surface-hover
        focus:bg-surface-hover
    `,
    raised: `
        bg-surface-hover
        hover:bg-[color-mix(in_srgb,var(--surface-hover),white_10%)]
        focus:bg-[color-mix(in_srgb,var(--surface-hover),white_10%)]
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
            <label htmlFor={inputId} className="text-s text-text-muted">{ label }</label>
            <textarea
                {...props}
                id={inputId}
                className={`
                    min-h-[60px] w-full max-h-[60vh] resize-y field-sizing-content text-m text-ink-strong border-2
                    border-transparent rounded-inner py-3 px-4 transition-[border-color,background-color] duration-300
                    focus:outline-0 focus:border-accent-blue
                    ${backgroundClassNames[background]}
                `}
            ></textarea>
        </div>
    )
}
