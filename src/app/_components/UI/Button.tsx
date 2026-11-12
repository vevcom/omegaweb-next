import React from 'react'
import type { ButtonHTMLAttributes } from 'react'


export type PropTypes = ButtonHTMLAttributes<HTMLButtonElement> & {
    children: React.ReactNode,
    color?: 'primary' | 'secondary' | 'green' | 'red',
    /** `text` reads as a link, for an action inside a row or next to a heading, where a filled button is too much. */
    variant?: 'filled' | 'text',
}

const colorClassNames = {
    primary: 'btn-primary',
    secondary: 'btn-neutral',
    green: 'btn-success',
    red: 'btn-error',
} as const

const textColorClassNames = {
    primary: 'text-primary',
    secondary: 'text-base-content',
    green: 'text-success',
    red: 'text-error',
} as const

export default function Button({ color = 'primary', variant = 'filled', children, className, ...props }: PropTypes) {
    return (
        <button
            className={variant === 'text' ? `
                shrink-0 border-none bg-transparent p-0 text-s cursor-pointer
                enabled:hover:underline
                disabled:text-base-content/80 disabled:cursor-not-allowed
                ${textColorClassNames[color]}
                ${className ?? ''}
            ` : `
                ${colorClassNames[color]}
                ${className ?? ''}
                disabled:bg-base-300 disabled:text-base-content/80
            `}
            {...props}
        >
            { children }
        </button>
    )
}
