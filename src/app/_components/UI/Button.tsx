import { buttonClassName } from './buttonClassName'
import React from 'react'
import type { ButtonLooks } from './buttonClassName'
import type { ButtonHTMLAttributes, Ref } from 'react'

export type PropTypes = ButtonHTMLAttributes<HTMLButtonElement> & ButtonLooks & {
    children: React.ReactNode,
    ref?: Ref<HTMLButtonElement>,
} & (
    // An icon says nothing to a screen reader, so a button of one alone must be named.
    | { variant: 'icon', 'aria-label': string }
    | { variant?: 'filled' | 'text' }
)

export default function Button({ color, variant, size, children, className, ...props }: PropTypes) {
    return (
        <button className={buttonClassName({ color, variant, size, className })} {...props}>
            { children }
        </button>
    )
}
