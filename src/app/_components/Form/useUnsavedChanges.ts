'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

function serialize(formData: FormData) {
    const entries: [string, string][] = []
    formData.forEach((value, name) => entries.push([name, value instanceof File ? value.name : value]))
    return JSON.stringify(entries)
}

/**
 * Whether a form holds anything other than what it started with or last saved. It compares what the
 * form would submit, so it covers every input, and looks again whenever one fires `input`. An input
 * whose value React sets fires it with `useInputEvent`.
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
        form.addEventListener('input', check)
        return () => form.removeEventListener('input', check)
    }, [enabled, formRef, check])

    const markSaved = useCallback((formData: FormData) => {
        savedRef.current = serialize(formData)
        check()
    }, [check])

    return { dirty, markSaved }
}
