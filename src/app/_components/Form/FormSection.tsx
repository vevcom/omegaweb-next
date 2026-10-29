'use client'
import { FormContext, FormInputSlot, flattenChildren, inputName } from './FormContext'
import { useContext } from 'react'
import type { ReactNode } from 'react'

const columnsClassNames = {
    1: 'grid-cols-1',
    2: `
        grid-cols-2
        max-mobile:grid-cols-1
    `,
} as const

/**
 * A group of the inputs of a Form under a legend. Its inputs get the room for their errors that the
 * direct children of the Form get.
 */
export default function FormSection({ legend, columns = 1, children }: {
    legend: string,
    /** Two puts the inputs side by side, in one column on mobile. */
    columns?: keyof typeof columnsClassNames,
    children: ReactNode,
}) {
    const form = useContext(FormContext)
    if (!form) throw new Error('FormSection må ligge inni et Form')

    return <fieldset className={`
        min-w-0 m-0 mb-2 p-0 border-none grid gap-x-4
        [&>legend]:mb-2 [&>legend]:text-l [&>legend]:font-bold
        ${columnsClassNames[columns]}
    `}>
        <legend>{legend}</legend>
        {flattenChildren(children).map((child, index) => {
            const name = inputName(child)
            return <FormInputSlot
                key={index}
                input={child}
                errors={(name && form.inputErrors[name]) || []}
                pending={form.pending}
            />
        })}
    </fieldset>
}
