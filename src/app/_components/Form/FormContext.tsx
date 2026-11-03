'use client'
import { Children, Fragment, createContext, isValidElement } from 'react'
import type { ReactNode } from 'react'
import type { ErrorMessage } from '@/services/error'

type FormContextType = {
    inputErrors: Partial<Record<string, ErrorMessage[]>>,
    pending: boolean,
}

/** What a Form shares with its sections: the errors of its inputs by name, and whether it is submitting. */
export const FormContext = createContext<FormContextType | null>(null)

/** The children with every fragment among them replaced by its own children, so each input stands on its own. */
export function flattenChildren(children: ReactNode): ReactNode[] {
    return Children.toArray(children).flatMap(child => (
        isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment
            ? flattenChildren(child.props.children)
            : [child]
    ))
}

/** The name the errors of an input are reported under: its `name`, or its `id` without one. */
export function inputName(child: ReactNode): string | undefined {
    if (!isValidElement<{ name?: unknown, id?: unknown }>(child)) return undefined
    if (typeof child.props.name === 'string' && child.props.name) return child.props.name
    if (typeof child.props.id === 'string') return child.props.id
    return undefined
}

/** One input of a Form, with the room for its errors below it. */
export function FormInputSlot({ input, errors, pending }: {
    input: ReactNode,
    errors: ErrorMessage[],
    pending: boolean,
}) {
    return (
        <span>
            <div>
                {input}
            </div>
            <p className={`
                text-accent-red flex flex-col min-h-[1.15em] mb-[3px]
                ${pending ? 'invisible' : ''}
            `}>
                {errors[0]?.message}
            </p>
        </span>
    )
}
