'use client'
import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

/**
 * Fires `input` on an input when React gives it another value. Typing fires the event by itself,
 * but a value set from state fires nothing, so a form that follows its values, as one with a save
 * bar does, would not hear of it.
 */
export function useInputEvent(inputRef: RefObject<HTMLInputElement | null>, value: string) {
    const announced = useRef(value)

    useEffect(() => {
        if (announced.current === value) return
        announced.current = value
        inputRef.current?.dispatchEvent(new Event('input', { bubbles: true }))
    }, [inputRef, value])
}

/**
 * Runs `onReset` when the form around an input is reset. The browser puts back what the inputs
 * started with, but knows nothing of a value held in state, so whoever holds one puts it back here.
 */
export function useFormReset(inputRef: RefObject<HTMLInputElement | null>, onReset: (() => void) | undefined) {
    const onResetRef = useRef(onReset)

    useEffect(() => {
        onResetRef.current = onReset
    })

    useEffect(() => {
        const form = inputRef.current?.form
        if (!form) return undefined
        const reset = () => onResetRef.current?.()
        form.addEventListener('reset', reset)
        return () => form.removeEventListener('reset', reset)
    }, [inputRef])
}

/**
 * The input of a field whose value is too nested for inputs of its own. It posts the value as JSON
 * under `name`, which `Zpn.json` on the schema side reads, and tells the form when the value
 * changes. `onReset` is where the field goes back to the value it started with.
 */
export default function JsonFieldInput({ name, value, onReset }: {
    name: string,
    value: unknown,
    onReset?: () => void,
}) {
    const inputRef = useRef<HTMLInputElement>(null)
    const json = JSON.stringify(value)
    useInputEvent(inputRef, json)
    useFormReset(inputRef, onReset)

    return <input ref={inputRef} type="hidden" name={name} value={json} />
}
