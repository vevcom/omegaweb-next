import React from 'react'
import type { ButtonHTMLAttributes } from 'react'


export type PropTypes = ButtonHTMLAttributes<HTMLButtonElement> & {
    children: React.ReactNode,
    color?: 'primary' | 'secondary' | 'green' | 'red',
}

const colorClassNames = {
    primary: 'btn',
    secondary: 'secondary-btn',
    green: 'btn [--btn-color:var(--accent-green)]',
    red: 'btn [--btn-color:var(--accent-red)]',
} as const

export default function Button({ color = 'primary', children, className, ...props }: PropTypes) {
    return (
        <button className={[
            colorClassNames[color],
            className ?? '',
            'disabled:bg-surface-hover disabled:text-text-muted',
        ].join(' ')} {...props}>
            { children }
        </button>
    )
}
