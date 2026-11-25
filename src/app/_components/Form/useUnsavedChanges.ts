'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, InputEvent, RefObject } from 'react'

function serialize(formData: FormData) {
    const entries: [string, string][] = []
    formData.forEach((value, name) => entries.push([name, value instanceof File ? value.name : value]))
    return JSON.stringify(entries)
}

/**
 * Whether a form holds anything other than what it started with or last saved. It compares what the
 * form would submit, so it covers every input, and looks again on `onInput` and `onChange`, which go
 * on the form, and when the form is reset. An input whose value React sets fires `input` with
 * `useInputEvent`.
 */
export function useUnsavedChanges(
    formRef: RefObject<HTMLFormElement | null>,
    enabled: boolean,
    onValuesChange?: (values: FormData) => void,
) {
    const [dirty, setDirty] = useState(false)
    const savedRef = useRef('')
    const onValuesChangeRef = useRef(onValuesChange)

    useEffect(() => {
        onValuesChangeRef.current = onValuesChange
    })

    const check = useCallback(() => {
        if (!formRef.current) return
        const values = new FormData(formRef.current)
        setDirty(serialize(values) !== savedRef.current)
        onValuesChangeRef.current?.(values)
    }, [formRef])

    useEffect(() => {
        const form = formRef.current
        if (!enabled || !form) return undefined
        savedRef.current = serialize(new FormData(form))
        check()
        // The browser resets the inputs after the event, so the values are read once it has.
        const checkAfterReset = () => setTimeout(check)
        form.addEventListener('reset', checkAfterReset)
        return () => form.removeEventListener('reset', checkAfterReset)
    }, [enabled, formRef, check])

    // React's own handlers and not listeners on the form, which run before React's. The state set
    // there would be rendered in between, putting a controlled input's old value back before React
    // sees the new one, so its onChange would never fire. A select tells React in `change`, which
    // the browser fires as an event of its own after `input`, so a select is looked at only then:
    // looked at on `input`, its onChange would read the old value.
    const onInput = useCallback((event: InputEvent<HTMLFormElement>) => {
        if (enabled && !(event.target instanceof HTMLSelectElement)) check()
    }, [enabled, check])

    const onChange = useCallback((event: ChangeEvent<HTMLFormElement>) => {
        if (enabled && event.target instanceof HTMLSelectElement) check()
    }, [enabled, check])

    const markSaved = useCallback((formData: FormData) => {
        savedRef.current = serialize(formData)
        check()
    }, [check])

    return { dirty, markSaved, onInput, onChange }
}
