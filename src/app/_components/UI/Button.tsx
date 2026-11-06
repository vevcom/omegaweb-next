import React from 'react'
import type { ButtonHTMLAttributes } from 'react'


export type PropTypes = ButtonHTMLAttributes<HTMLButtonElement> & {
    children: React.ReactNode,
    color?: 'primary' | 'secondary' | 'green' | 'red',
}

const colorClassNames = {
    primary: 'btn-primary',
    secondary: 'btn-neutral',
    green: 'btn-success',
    red: 'btn-error',
} as const

export default function Button({ color = 'primary', children, className, ...props }: PropTypes) {
    return (
        <button
            className={`
                ${colorClassNames[color]}
                ${className ?? ''}
                disabled:bg-surface-hover disabled:text-base-content/80
            `}
            {...props}
        >
            { children }
        </button>
    )
}
