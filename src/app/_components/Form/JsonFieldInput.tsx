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
 * The input of a field whose value is too nested for inputs of its own. It posts the value as JSON
 * under `name`, which `Zpn.json` on the schema side reads, and tells the form when the value changes.
 */
export default function JsonFieldInput({ name, value }: { name: string, value: unknown }) {
    const inputRef = useRef<HTMLInputElement>(null)
    const json = JSON.stringify(value)
    useInputEvent(inputRef, json)

    return <input ref={inputRef} type="hidden" name={name} value={json} />
}
